
function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
};

document.getElementById("solobutton222").addEventListener("click", function() {
    startSolo(2);
});
document.getElementById("solobutton333").addEventListener("click", function() {
    startSolo(3);
});
document.getElementById("solobutton444").addEventListener("click", function() {
    startSolo(4);
});
document.getElementById("solobutton555").addEventListener("click", function() {
    startSolo(4);
});

if(getUrlParameter('go') == 'solo'){
    startSolo();
}

function startSolo(size = 2){
    console.log("Starting solo game", size);
    const sidePermutations = {
        'U': 'U',
        'D': 'D',
        'L': 'L',
        'R': 'R',
        'F': 'F',
        'B': 'B'
    };

    const layoutCheckbox = document.getElementsByName('randomize_layout').item(0);
    if (layoutCheckbox.checked) {
        const sideValues = Object.values(sidePermutations);
        for (let key in sidePermutations) {
            sidePermutations[key] = sideValues.splice(Math.floor(Math.random() * sideValues.length), 1)[0];
        }
    }


    // Add the event listener and keep a reference to the handler
    const beforeUnloadHandler = function (e) {
        const confirmationMessage = "Are you sure you want to leave this page?";
        e.preventDefault();
        e.returnValue = confirmationMessage;
        return confirmationMessage;
    };
    window.addEventListener("beforeunload", beforeUnloadHandler);

    document.getElementById("login-container").style.display = "none";
    document.getElementById("ui").style.display = "block";

    var size = size || parseInt(getUrlParameter('size')) || 2;
    var stickersUnlocked = 0;
    var lockedStickers = [];

    function connectToServer(firsttime = true) {
        
        window.startGame(parseInt(size), sidePermutations);

        const colors = ['L', 'R', 'U', 'D', 'F', 'B'];
        for(let i=1; i<=size*size; i++){
            for(const color of colors){
                lockedStickers.push([color, i]);
            }
        }
        
        lockedStickers.sort(() => Math.random() - 0.5);

        let unlocks = 5;
        if(getUrlParameter('unlocks')){
            unlocks = parseInt(getUrlParameter('unlocks'));
        }
        for(let i=0; i<unlocks; i++){
            let sticker = lockedStickers.pop();
            window.unlockSticker(sticker);
            stickersUnlocked++;
        }
    }
    


    window.connectToServer = connectToServer;

    console.log("0.0.1 solo", size)
    window.is_connected = false;


    function findAndDetermineChecks(counts){        
        if(counts == stickersUnlocked){
            if(lockedStickers.length > 0){
                let sticker = lockedStickers.shift();
                stickersUnlocked++;
                window.unlockSticker(sticker);
                console.log("Unlocked sticker ", sticker);
            }
        }
    }

    window.findAndDetermineChecks = findAndDetermineChecks;
    window.sendGoal = function() {
        console.log("Congratulations!");
        window.removeEventListener("beforeunload", beforeUnloadHandler);
    };

    connectToServer(true);
}