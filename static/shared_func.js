const inputField = document.getElementById("messageInput");
const main = document.getElementById("main-page");
const instruction = document.getElementById("instructionsPage");
const queue = document.getElementById("queuePage");
const draft_list = document.getElementById("draftPage");
const pages = [main, instruction, queue, draft_list];
let last_vote = '';
let host_code = '2222';
let game_states = { need_code: 'need_code', need_name: 'need_name', drafting: 'drafting', vote: 'voting' };
let headers_text = { need_code: 'Enter Room Code', need_name: 'Enter Your Name', refresh: 'Try to Refresh Page.', drafting: 'Get Ready to Draft' }
let game_state = game_states.need_code;
let access_code = ''
let user_id = ''
let drag_time
let form_submittion_states = { names: 'names', death_picks: 'death_picks' };
let form_type = form_submittion_states.death_picks
let reconnections = 0;
let myVar
let url = 'wss:/qrku7dmlia.execute-api.us-east-2.amazonaws.com/production/'
let socket
let draggedItem = null;

class TransitionButton extends HTMLElement {
    connectedCallback() {
        const label = this.getAttribute("label") || "Click";
        const target = this.getAttribute("target");

        this.innerHTML = `<button class="transition-button">${label}</button>`;
        this.querySelector("button").addEventListener("click", () => {
            if (target) switchPage(target);
        });
    }
}
class QueueItem extends HTMLElement {
    constructor() {
        // Always call super first in constructor
        super();
    }
    connectedCallback() {
        const label = this.getAttribute("label")
        this.style.display = 'flex'
        this.className = 'queueItem'
        this.innerHTML = `
        <div class='button-row' style='gap: 40%; justify-items:space-between;'>
            <button id="draft">Draft</button>
            <button id="delete">Delete</button>
        </div>
        <span>${label}</span>
        `;
        this.querySelector("#draft").addEventListener("click", () => {
            draftClick(label)
        });
        this.querySelector("#delete").addEventListener("click", () => {
            deleteByName(label)
        });
    };

}

class SuddenDeath extends HTMLElement {
    constructor() {
        // Always call super first in constructor
        super();
    }
    connectedCallback() {
        const label = this.getAttribute("label")
        const name = this.getAttribute("name")
        const value = this.getAttribute("value")
        this.style.display = 'flex'
        this.style.alignItems = 'center'
        this.style.justifyContent = 'center'
        this.innerHTML = `
        <input type="radio" id="${label}" name="option" value="${value}"/>
        <label for="${label}">${value.slice(0, 15)}</label>
        `;
    };

}

customElements.define("sudden-death", SuddenDeath);
customElements.define("transition-button", TransitionButton);
customElements.define("queue-item", QueueItem);

function getIndex(element) {
    return [...element.parentNode.children].indexOf(element);
}
inputField.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        sendMessage();
        inputField.blur();
    }
});


function saveList() {
    let listItems = [];
    document.querySelectorAll("#queue li").forEach(li => {
        listItems.push({ text: li.querySelector("span").textContent });
    });
    localStorage.setItem("listItems", JSON.stringify(listItems));
}

function changeButtonColor(color, button_id) {
    document.getElementById(button_id).style.backgroundColor = color;
    if (color=='green') {
        setTimeout(() => {
       resetVoteButton();
    }, 4000);
    }
}

function resetVoteButton() {
    changeButtonColor(document.documentElement.style.getPropertyValue('--bg'), 'left')
    changeButtonColor(document.documentElement.style.getPropertyValue('--bg'), 'right')
}

function loadList() {
    let storedList = JSON.parse(localStorage.getItem("listItems"));
    if (storedList) {
        storedList.forEach(item => {

            addDraftItem(item.text);
        });
    }
}

function addDraftItem() {
    const queueInput = document
        .getElementById('queueInput');
    let draftPick = queueInput.value
    if (draftPick) {
        let ul = document.getElementById("queue");
        let li = document.createElement('li')
        let queueitem = document.createElement('queue-item')
        queueitem.setAttribute('label', draftPick)
        // makeDraggable(li)
        li.appendChild(queueitem)
        ul.appendChild(li);
        saveList();
        queueInput.value = ''
        queueInput.focus();
    }
}

function clickDelete(pick) {
    deleteByName(pick)
    saveList();
}

function draftClick(pick) {
    socketSend({ action: 'pick', pick: pick });
}

function makeDraggable(item) {
    item.draggable = true;
    item.addEventListener("touchstart", function (e) {
        drag_time = setTimeout(() => {
            draggedItem = this;
        }, 2000);
    });

    item.addEventListener("touchend", function (e) {
        draggedItem = null;
        alert(draggedItem)

        // item.draggable = false;
        clearTimeout(drag_time)
        // this.style.color = "rgb(65, 32, 250)";
        // this.style.opacity = "1"; // Reset opacity after drop
    });

    item.addEventListener("touchmove", function (e) {
        alert(draggedItem)

        if (draggedItem) {
            e.preventDefault();
            let touch = e.touches[0];
            let targets = document.elementsFromPoint(touch.clientX, touch.clientY);
            let dropTarget = null
            let draggedIndex = getIndex(draggedItem);
            let targetIndex = getIndex(dropTarget);
            alert(targets)
            if (dropTarget && dropTarget.parentNode === draggedItem.parentNode) {
                if (draggedIndex > targetIndex) {
                    this.parentNode.insertBefore(draggedItem, dropTarget);
                } else {
                    this.parentNode.insertBefore(draggedItem, dropTarget.nextElementSibling);
                }
            }
        }
    })
    item.querySelectorAll("button").forEach(button => {
        button.addEventListener("touchstart", function (e) {
            e.stopImmediatePropagation(); // Stops touch event from affecting drag
        });
    });
};

function vibratePhone() {
    // Check if the Vibration API is supported
    if (navigator.vibrate) {
        // Vibrate for 500 milliseconds
        navigator.vibrate(500);
    }
};
function checkGameState(needed_state) {
    return game_state == needed_state
};
function sendMessage() {
    let message = inputField.value;
    if (socket.readyState === WebSocket.CLOSED) {
        window.location.reload();
        return
    }
    if (message) {
        if (message === host_code) {
            socketSend({ action: 'host', subaction: 'make_host' });
        }
        else if (checkGameState(game_states.need_code)) {
            access_code = message
            socketSend({ action: 'start' });
        }
        else if (checkGameState(game_states.need_name)) {
            socketSend({ action: 'name', name: message });
        }
        else if (checkGameState(game_states.drafting)) {
            socketSend({ action: 'pick', pick: message })
        }
        inputField.value = '';
    }
}
function showPopup(options) {
    const form = document.getElementById("radio_container");
    const form_button = document.getElementById("form_button");
    options.forEach((opt, index) => {
        let radio = document.createElement('sudden-death')
        radio.setAttribute('label', `opt${index}`)
        radio.setAttribute('name', index)
        radio.setAttribute('value', opt)
        form.insertBefore(radio, form_button)
    });
    disableBackgroundInteraction(true)
    document.getElementById("popup").style.display = "block";
}

// Source - https://stackoverflow.com/a
// Posted by Александр Шевченко
// Retrieved 2025-11-27, License - CC BY-SA 4.0
/**
 * Removes all sibling elements after specified
 * @param {HTMLElement} currentElement
 * @private
 */
function clearOptions() {
    radio_container=document.getElementById("radio_container")
    radio_container.querySelectorAll("sudden-death").forEach((elem) => {
        elem.remove();
    });
}

function submitOption() {
    const selected = document.querySelector('input[type="radio"]:checked');
    if (selected) {
        if (form_type == form_submittion_states.death_picks) {
            socketSend({ action: 'sudden_death', pick: selected.value });

        } else if (form_type == form_submittion_states.names) {
            socketSend({ action: 'reconnect', selected_name: selected.value })
        }
        alert("You selected: " + selected.value);
        clearOptions();
        disableBackgroundInteraction(false);
        document.getElementById("popup").style.display = "none";
    } else {
        alert("Please select an option.");
    }

}

function disableBackgroundInteraction(disable) {
    document.body.style.pointerEvents = disable ? 'none' : 'auto';
    document.getElementById("popup").style.pointerEvents = "auto"; // allow popup interaction
}

function deleteByName(pick) {
    let lis = document.getElementById("queue").querySelectorAll("li");
    for (let li of lis) {
        if (li.querySelector('span').textContent === pick) {
            li.remove();
            saveList();
            break;
        }
    }
}

function addtoDash(text) {
    const outputDiv = document
        .getElementById('output');
    outputDiv.innerHTML += `<p><b>"${text}"</b></p>`;
}
function addtoDraftPage(text) {
    const outputDiv = document
        .getElementById('draft_output');
    outputDiv.innerHTML += `<p><b>"${text}"</b></p>`;
}
function populateDraftPage(answers) {
    document.getElementById('draft_output').innerHTML = '';
    for (let [pick, name] of Object.entries(answers)) {
        addtoDraftPage(`${name} drafted ${pick}`);
    }
}
function makeHost() {
    vibratePhone();
    document.getElementById('host').style.display = 'grid';
};

function hostCommand(command) {
    socketSend({ action: 'host', subaction: command });
}

function changeHeader(new_header, header_id) {
    document.getElementById(header_id).innerText = new_header;
}
function changeAllHeaders(new_header) {
    changeHeader(new_header, 'header');
    changeHeader(new_header, 'header1');
    changeHeader(new_header, 'header2');
}
function vote(vote) {
    if (socket.readyState === WebSocket.CLOSED) {
        window.location.reload();
        return
    }
    if (checkGameState(game_states.vote)) {
        socketSend({ action: 'vote', vote: vote });
        resetVoteButton();
        changeButtonColor('yellow', vote);
        last_vote = vote;
    }
};

function switchPage(page_id) {
    for (let page of pages) {
        page.style.display = 'none';
    }

    document.getElementById(page_id).style.display = 'block';
}

function socketSend(message) {
    message['type'] = 'player'
    message['code'] = access_code
    message['ID'] = user_id
    console.log(message)
    if (socket.readyState === WebSocket.OPEN) {
        try {
            socket.send(JSON.stringify(message))
        } catch (error) {
            console.log(error)
        }
    }
}

function checkCode() {
    let code = localStorage.getItem('room_code')
    checkID()
    if (!code) {
        return
    }
    code = JSON.parse(code)
    if (user_id) {
        if (confirm(`Return to room ${code}?`)) {
            access_code = code
            socketSend({ action: 'reconnect' });
        } else {
            localStorage.clear()
            access_code = null
            user_id = null
        }
    }
}

function checkID() {
    user_id = localStorage.getItem('user_id')
    if (!user_id) {
        user_id = null
        return
    }
    user_id = JSON.parse(user_id)
}
function pingPong() {
    socketSend({ action: 'ping' })
}

// Source - https://stackoverflow.com/a
// Posted by blow, modified by community. See post 'Timeline' for change history
// Retrieved 2025-11-24, License - CC BY-SA 4.0

function setTimedInterval(callback, delay, timeout) {
    myVar = window.setInterval(callback, delay);
    window.setTimeout(function () {
        window.clearInterval(myVar);
    }, timeout);
}

async function socketConnect(use_local_ws = false) {
    if (use_local_ws) {
        url = await get_ws_url()
    }
    console.log(url)
    socket = new WebSocket(url);

    socket.onopen = function (event) {
        myVar = setTimedInterval(pingPong, 1000 * 60, 3000000);
        changeAllHeaders(headers_text.refresh);
        checkCode();
        reconnections = 0;
        if (game_state == game_states.need_code) {
            changeAllHeaders(headers_text.need_code);
        }
    };
    socket.onmessage = function (event) {
        if (event.data) {
            console.log(event.data);
            parse_message(JSON.parse(event.data));
        }
    };
    socket.onclose = function (event) {
        clearInterval(myVar);
        if (reconnections < 3) {
            socketConnect(use_local_ws);
            reconnections += 1;
        }
        changeAllHeaders(headers_text.refresh);
    };
}
async function get_ws_url() {
    let url_json = await fetch('/data')
        .then(response => response.json())
    return url_json
}
function parse_message(message) {
    console.log(message);
    switch (message.action) {
        case 'game_state':
            game_state = message.state
            host_code = message.host_code
            switch (message.state) {
                case 'wait':
                    document.getElementById('draft_output').innerHTML = '';
                    if (message.in_game) {
                        changeAllHeaders(headers_text.drafting);
                    } else {
                        inputField.focus()
                        changeAllHeaders(headers_text.need_name);
                    }
                    document.getElementById('queue').innerHTML = '';
                    localStorage.removeItem('listItems');
                    break;
                case 'draft':
                    changeAllHeaders("Drafting Topic".replace("Topic", message.topic));
                    game_state = game_states.drafting
                    populateDraftPage(message.answers)
                    break;
                case 'vote':
                    changeHeader('Vote w/ Left or Right Button', 'header');
                    changeHeader('Return to Main Page with Top Left Button', 'header1');
                    game_state = game_states.vote
                    document.getElementById('queue').innerHTML = '';
                    switchPage('main-page');
                    localStorage.removeItem('listItems');
                default:
                    break;
            }

        case 'too_similar':
            switch (message.subaction) {
                case 'pick':
                    if (confirm(message.warning + '\n Do you still want to draft this?'.replace("this", message.pick))) {
                        socketSend({ action: 'draft_override', pick: message.pick });
                    } else {
                        alert('Try Again');
                    }
                    break;
                case 'name':
                    alert('That name\'s taken')
                    break;
            };
            break;

        case 'matchup':
            resetVoteButton();
            break;

        case 'stop':
            clearInterval(myVar)
            reconnections = 10
            socket.close()
            localStorage.clear()
            alert('Thanks for Playing')
            break;

        case 'new_pick':
            addtoDraftPage(`${message.name} drafted ${message.pick}`);
            break;
        case "reconnect":
            switch (message.subaction) {
                case 'failure':
                    alert('We couldn\'t reconnect you');
                    break;
                case 'present_names':
                    form_type = form_submittion_states.names
                    document.getElementById('options_legend').textContent = 'Confirm Your Old Name:'
                    showPopup(message.names)
                    break;
                case 'ask_name':
                    socketSend({ action: 'reconnect', old_name: prompt('What was your name?') });
                    break;
                case 'success':
                    access_code = message.code;
                    localStorage.setItem("room_code", JSON.stringify(access_code));
                    addtoDash(notification)
                    user_id = message.ID
                    localStorage.setItem("user_id", JSON.stringify(user_id));
                    saveList();
                    break;
            }

        case 'notify_player':
            switch (message.subaction) {
                case "wrong_code":
                    access_code = null;
                    alert(message.warning)
                    break;
                case "your_turn":
                case 'snitch':
                case 'vote':
                    alert(message.warning)
                    break;
                case 'confirm_code':
                    access_code = message.code;
                    game_state = game_states.need_name
                    inputField.focus()
                    saveList();
                    localStorage.setItem("room_code", JSON.stringify(access_code));
                    changeAllHeaders(headers_text.need_name);
                    break;
                case 'confirm_player':
                    let notification = "Got it, you're {message['name']}.".replace("{message['name']}", message.name)
                    addtoDash(notification)
                    user_id = message.ID
                    localStorage.setItem("user_id", JSON.stringify(user_id));
                    changeAllHeaders(headers_text.drafting)
                    game_state = game_states.drafting
                    break;
                case 'confirm_pick':
                    let pick = "You drafted {message['pick']}.".replace("{message['pick']}", message.pick);
                    addtoDash(pick);
                    deleteByName(message.pick);
                    break;
                case 'confirm_host':
                    makeHost();
                    break;
                case 'confirm_vote':
                    changeButtonColor('green', last_vote);
                    break;
                case 'topic_select':
                    let userInput = prompt("What's the Topic?");
                    socketSend({ action: 'host', subaction: 'topic_select', topic: userInput });
                    break;
                case 'sudden_death':
                    form_type = form_submittion_states.death_picks
                    document.getElementById('options_legend').textContent = 'Select Your Best Pick:'
                    showPopup(message.picks);
                    break;
                case 'restart':
                    document.getElementById('draft_output').innerHTML = '';
                    document.getElementById('output').innerHTML= '';
                    if (confirm('Wanna play again?')) {
                        socketSend({ action: 'restart', answer: true });
                    } else {
                        socketSend({ action: 'restart', answer: false });
                        alert('bye bye');
                        reconnections = 10
                        socket.close()
                    };
                    break;
            }
    };

}
// parse_message({'action':'reconnect',subaction:'present_names',names:['asdf','asdfsd']})

// parse_message({"action": "notify_player", "subaction": "sudden_death", "picks": ["jhj ", "j j", " jkk"]})