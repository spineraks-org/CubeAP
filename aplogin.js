
function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
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

function startAP(){
    document.getElementById("login-container").style.display = "none";
    document.getElementById("ui").style.display = "block";

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
        
        
        client
        .login(hostport, name, "Twisty Cube", {password: password})
            .then(() => {
                console.log("Connected to the server");
            })
            .catch((error) => {
                console.log("Failed to connect", error)
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
            let firstIndex = items[i][2];
            let indexItem = items[i][1];
            let item = items[i][0];
            const color = item.charAt(0);
            // Map color letter to side
            const colorToSide = {
                'W': 'U',
                'Y': 'D',
                'R': 'F',
                'O': 'B',
                'B': 'R',
                'G': 'L'
            };
            const side = colorToSide[color] || color;

            window.unlockSticker([side, item.split("#")[1]]);
        }
    }

    const connectedListener = (packet) => {
        window.is_connected = true;
        apstatus = "AP: Connected";
        console.log("Connected packet: ", packet);

        window.size = packet.slot_data.size_of_cube;
        window.startGame(window.size);

        // Add the event listener and keep a reference to the handler
        const beforeUnloadHandler = function (e) {
            const confirmationMessage = "Are you sure you want to leave this page?";
            e.preventDefault();
            e.returnValue = confirmationMessage;
            return confirmationMessage;
        };
        window.addEventListener("beforeunload", beforeUnloadHandler);
    };

    const disconnectedListener = (packet) => {
        window.is_connected = false;
        apstatus = "AP: Disconnected. Progress saved, please refresh.";
        alert("Disconnected from the server. Please refresh.");
        window.removeEventListener("beforeunload", beforeUnloadHandler);
    };

    var highScore = 0
    function findAndDetermineChecks(total){
        console.log(highScore, total);
        if(total <= highScore) return;
        for (let i = highScore + 1; i <= total; i++) {
            sendCheck(267780000 + i);
        }
        highScore = Math.max(highScore, total);
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
        window.removeEventListener("beforeunload", beforeUnloadHandler);
    }

    window.sendCheck = sendCheck;
    window.sendGoal = sendGoal;

    console.log("0.0.1")
    connectToServer();
}