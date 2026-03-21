import GameOptions from "./src/game/GameOptions.js";
import {Client} from "./lib/archipelago.js";

function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
};

// Map color letter to side
const colorToSide = {
    'White': 'U',
    'Yellow': 'D',
    'Red': 'F',
    'Orange': 'B',
    'Blue': 'R',
    'Green': 'L'
};

// server stuff:

document.getElementById('loginbutton').addEventListener('click', function() {
    startAP();
});

if(getUrlParameter('go') == 'LS'){
    startAP();
}

function getGameOptionsFromVersion(version, slotData) {
    const totalStickers = 6*slotData.size_of_cube*slotData.size_of_cube;
    if (version === "0.0.1") {
        if(!localStorage.getItem("referredTo100")){
            alert("There is a new version with many new features! But this version (probably) still works!")
            localStorage.setItem("referredTo100", true);
        }
        return new GameOptions(slotData.size_of_cube, null, totalStickers, totalStickers);
    }

    const sidePermutations = convertColorPermutationToSidePermutation(slotData.color_permutation, version);

    if (version === "0.0.2") {
        if(!localStorage.getItem("referredTo100")){
            alert("There is a new version with many new features! But this version (probably) still works!")
            localStorage.setItem("referredTo100", true);
        }
        return new GameOptions(slotData.size_of_cube, sidePermutations, totalStickers, totalStickers);
    }
    else if (version === "1.0.0") {
        return new GameOptions(slotData.size_of_cube, sidePermutations, slotData.minimum_stickers_unlocked_to_goal_when_solved, totalStickers);
    }

    throw new Error(`Cannot generate the options for AP version ${version}`);
}

/**
 * Converts the AP world color permutation into the frontend side permutation
 *
 * @param {Object} colorPermutation
 * @param {string} version AP world version.
 * @returns {Object.<string, string>|null}
 */
function convertColorPermutationToSidePermutation(colorPermutation, version) {
    if (colorPermutation === null) {
        return null;
    }

    let sidePermutations = {};
    // This is bugged for version 0.0.2
    // If the randomized layout is exactly the default one, it will be considered non-randomized
    // Considering this is temporary and only 1/720, it's probably fine.
    let isLayoutRandomized = false;
    for (const key in colorPermutation) {
        if (key !== colorPermutation[key]) {
            isLayoutRandomized = true;
        }
        sidePermutations[colorToSide[key]] = colorToSide[colorPermutation[key]]
    }

    if (version === "0.0.2") {
        return isLayoutRandomized ? sidePermutations : null;
    }

    return sidePermutations;
}

function getSeed(slotData) {
    return slotData.seed_name;
}

function startAP(){
    document.getElementById("login-container").style.display = "none";
    document.getElementById("loading-screen").style.display = "flex";

    localStorage.setItem("hostport", document.getElementById("hostport").value);
    localStorage.setItem("name", document.getElementById("name").value);


    var client = null;
    var apstatus = "?";
    window.is_connected = false;


    function connectToServer(firsttime = true) {
        const hostport = localStorage.getItem("hostport");
        const name = localStorage.getItem("name");
        const password = document.getElementById("password").value;

        console.log("Connecting to server...");
        client = new Client();
        client.items.on("itemsReceived", receiveditemsListener);
        client.socket.on("connected", connectedListener);
        client.socket.on("disconnected", disconnectedListener);
        client.deathLink.on("deathReceived", deathListener);
        
        
        client
        .login(hostport, name, "Twisty Cube", {password: password, tags: ["DeathLink"]})
            .then(() => {
                console.log("Connected to the server");
            })
            .catch((error) => {
                let errorMessages = ['Error while connecting to the server:\n'];
                if (typeof error.errors === 'undefined') {
                    errorMessages.push('Make sure that the server and the port are correct.')
                }
                else {
                    for (const errorCode of error.errors) {
                        switch (errorCode) {
                            case 'InvalidSlot':
                                errorMessages.push('This slot does not exist. Make sure that the player name is correct.')
                                break
                            case 'InvalidPassword':
                                errorMessages.push('The password is not correct.')
                                break;
                        }
                    }
                }
                alert(errorMessages.join('\n'));
                document.getElementById("login-container").style.display = "flex";
                document.getElementById("loading-screen").style.display = "none";
            });

    }

    const receiveditemsListener = (items, index) => {
        newItems(items, index);
    };

    var lastindex = 0;
    function newItems(items, index) {
        if (items && items.length) {
            if (index > lastindex) {
                alert("Something strange happened, you should have received more items already... Let's reconnect...");
                console.log("Expected index:", lastindex, "but got:", index, items);
            }
            var received_items = [];
            for (let i = lastindex - index; i < items.length; i++) {
                const item = items[i]; // Get the current item
                received_items.push([item.toString(), i, index]); // Add the item name to the 'items' array
            }
            openItems(received_items)
            lastindex = index + items.length;
        } else {
            console.log("No items received in this update...");
        }
    }

    function openItems(items) {
        for (let i = 0; i < items.length; i++) {
            let item = items[i][0];
            const color = item.split(' ', 2)[0];
            const expectedSide = colorToSide[color];
            const realSide = Object.keys(window.game.sidePermutation)
                .find(key => window.game.sidePermutation[key] === expectedSide);
            
            if (realSide === undefined) {
                console.log('Cannot associate AP color to a side', color);
                continue;
            }
            window.unlockSticker([realSide, parseInt(item.split("#")[1])]);
        }
    }

    const connectedListener = (packet) => {
        const networkSlot = packet.slot_info[packet.slot]

        window.is_connected = true;
        apstatus = "AP: Connected";
        console.log("Connected packet: ", packet);
        document.getElementById("loading-screen").style.display = "none";
        document.getElementById("ui").style.display = "block";
        window.version = packet.slot_data.ap_world_version ?? '0.0.1';
        document.getElementById('version').innerHTML = 'v' + window.version;
        const options = getGameOptionsFromVersion(window.version, packet.slot_data);
        const seed = getSeed(packet.slot_data);
        window.startGame(options, seed, `$Cube_${seed}_${networkSlot.name}$`);

        // Add the event listener and keep a reference to the handler
        window.beforeUnloadHandler = function (e) {
            const confirmationMessage = "Are you sure you want to leave this page?";
            e.preventDefault();
            e.returnValue = confirmationMessage;
            return confirmationMessage;
        };
        window.addEventListener("beforeunload", window.beforeUnloadHandler);
    };

    const disconnectedListener = (packet) => {
        window.is_connected = false;
        apstatus = "AP: Disconnected. Progress saved, please refresh.";
        alert("Disconnected from the server. Please refresh.");
        window.removeEventListener("beforeunload", window.beforeUnloadHandler);
    };

    function deathListener(source, time, cause){
        console.log("Received death link from", source, "at time", time, "due to", cause);
        window.doDeathLink(source, cause);
    }

    function findAndDetermineChecks(total){
        for (let i = window.lastCorrectSent + 1; i <= total; i++) {
            sendCheck(267780000 + i);
            window.lastCorrectSent = i;
        }
    }
    window.findAndDetermineChecks = findAndDetermineChecks;

    function sendCheck(key){
        if(window.is_connected){
            client.check(parseInt(key));
            console.log("Sent check for ", key);
        }
    }
    function sendGoal(){
        client.goal();
        window.removeEventListener("beforeunload", window.beforeUnloadHandler);
    }

    window.sendCheck = sendCheck;
    window.sendGoal = sendGoal;

    console.log("1.0.0")
    connectToServer();
}