
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
import {
    Client
} from "./archipelago.js";

document.getElementById('loginbutton').addEventListener('click', function() {
    startAP();
});

if(getUrlParameter('go') == 'LS'){
    startAP();
}

/**
 * Extract the cube size from the slot data
 *
 * @param {Object} slotData
 * @returns {number}
 */
function getCubeSize(slotData) {
    return slotData.size_of_cube;
}

/**
 * Extract the side permutations from the slot data
 *
 * @param {Object} slotData
 * @returns {Object.<string, string>}
 */
function getSidePermutations(slotData) {
    if (window.version === '0.0.1') {
        return {
            'U': 'U',
            'D': 'D',
            'L': 'L',
            'R': 'R',
            'F': 'F',
            'B': 'B'
        }
    }

    let sidePermutations = {};
    for (const key in slotData.color_permutation) {
        sidePermutations[colorToSide[key]] = colorToSide[slotData.color_permutation[key]]
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
        const hostport = localStorage.getItem("hostport");
        const name = localStorage.getItem("name");

        window.is_connected = true;
        apstatus = "AP: Connected";
        console.log("Connected packet: ", packet);
        document.getElementById("loading-screen").style.display = "none";
        document.getElementById("ui").style.display = "block";
        window.version = packet.slot_data.ap_world_version ?? '0.0.1';
        document.getElementById('version').innerHTML = 'v' + window.version;
        const size_of_cube = getCubeSize(packet.slot_data);
        const sidePermutations = getSidePermutations(packet.slot_data);
        const seed = getSeed(packet.slot_data);
        window.startGame(size_of_cube, sidePermutations, seed, `${name}@${hostport}`);

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

    console.log("0.0.2")
    connectToServer();
}