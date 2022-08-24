"use strict";

let innerwrapper;
let outerwrapper;
let queryparam;
let showlist = false;
let username = {
    "username": ""
}
let searchhistory = {
    "username":"",
    "searchterm": []
}

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("unload", logout);

// Startfunktion: Prüft auf Login (wird unter anderem im SessionStorage vermerkt), wenn nein wird auf index.html verlinkt
function init(){
    username.username = sessionStorage.getItem("Username");
    if (username.username == null){
        window.location.href = "index.html";
    } else {
        document.getElementById("search").addEventListener("click", searchTweet);
        document.getElementById("showsearchtermlist").addEventListener("click", searchtermList);
        document.getElementById("delete").addEventListener("click", clearScreen);
        document.getElementById("logout").addEventListener("click", logout); 
    }
}

// Leert Tweetinhalt auf dem Bildschirm
function clearScreen(){
    let toclear = document.querySelectorAll('.tweet');
    for (let i = 0; i < toclear.length; i++){
        toclear[i].remove();
    }
}

// Logout funktion
function logout(){
    safehistory();
    window.location.href = "index.html";
}

// Anzeigen oder ausblenden Suchhistorie
function searchtermList(){
    let show = document.getElementById("searchtermlist");
    if (show != null){
        show.remove();
        showlist = false;
    } else {
        makesearchtermList()
        showlist = true;
    }
}

// Erstellt Liste mit Suchhistorie in DOM
function makesearchtermList(){
    let remove = document.getElementById("searchtermlist");
    if (remove != null){
        remove.remove();
    }
    // Elemente aus Local Storage laden
    const storage = { ...localStorage};

    // Liste Erstellen und Elemente aus local Storage einfügen
    outerwrapper = document.getElementById("outerwrapper");
    const searchtermlist = document.createElement("aside");
    searchtermlist.className = "bg-primary text-white card";
    searchtermlist.id = "searchtermlist";
    outerwrapper.appendChild(searchtermlist);
    const list = document.createElement("ul");
    searchtermlist.appendChild(list);
    const listheading = document.createElement("lh");
    listheading.innerText = "Suchbegriffe:";
    list.appendChild(listheading);
    for (let i in storage){
        const listItem = document.createElement("li");
        listItem.id = storage[i];
        list.appendChild(listItem);
        listItem.innerText = storage[i];
        document.getElementById(storage[i]).addEventListener("click", searchtermListSearch);
    } 
    const button = document.createElement("div");
    button.id = "buttonwrapper";
    searchtermlist.appendChild(button)
    const safe = document.createElement("button");
    safe.className = "btn btn-light"; 
    safe.id = "safebutton";
    safe.innerText = "Speichern";
    button.appendChild(safe);
    safe.addEventListener("click", safehistory);
    const deletelist = document.createElement("button");
    deletelist.className = "btn btn-light"; 
    deletelist.id = "deletelistbutton";
    deletelist.innerText = "Liste Löschen";
    button.appendChild(deletelist);
    deletelist.addEventListener("click", deleteList);
    const statusmessage = document.createElement("p");
    statusmessage.id = "statusmessage";
    button.appendChild(statusmessage);   
}

// Führt Twitteranfrage mit angeklickten Suchbegruff aus der Liste der Suchhistorie
function searchtermListSearch(event){
   queryparam = event.target.id;
   getTweet(queryparam).then(data => tweet(data));
}

// Speichern der Suchhistorie auf Server
async function safehistory(){
    // Auslesen aus localStorage
    const storage = { ...localStorage};
    searchhistory.username = username.username;
    searchhistory.searchterm = [];
    for (let n in storage){
        searchhistory.searchterm.push(storage[n]);
    }

    let response = await fetch("/history", { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(searchhistory)});
    let responsetext = await response.text();
    // Statusanzeige, ob Speichern erfolgreich war oder nicht
    document.getElementById("statusmessage").innerText = responsetext;
    setTimeout(function(){ document.getElementById("statusmessage").innerText = " "; },2000);
}

// Suchhistorie löschen
function deleteList(){
    localStorage.clear();
    if (showlist){
        makesearchtermList();
    }
}

// Holen des Suchbegriffs und weiterleiten der Daten an Fetch Funktion
function searchTweet(){  
    queryparam = document.getElementById("searchterm").value;
    document.getElementById("searchterm").value = "";

    if(queryparam != "") {
       // Responsedaten aus Fetch werden an tweet übergeben 
       getTweet(queryparam).then(data => tweet(data));
    } else {
        const error = {text:"Bitte einen Suchbegriff in Textfeld eingeben"};
        displayTweet(error);
    }   
}

// Fetch der Tweets
async function getTweet(querystring){
    // Update Suchhistorie wenn gewünscht
    if(document.getElementById("safesearchterm").checked == true){
        localStorage.setItem(querystring,querystring);
        if (showlist){
            makesearchtermList();
        }
    }

    // Fetch mit senden Nutzernamen zwecks Berechtigungsprüfung bei Server
    let response = await fetch("/search?query="+querystring, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(username)});
    let data = await response.json();
    return data; 
}

// Aufbereiten der Tweets und weiterleiten an Anzeige Funktion
function tweet(twitterdata){ 
   document.getElementById("safesearchterm").checked = false;

    for (let i = 0; i < twitterdata.data.length; i++) {
        if (twitterdata.data[i].attachments.media_keys == null){
            displayTweet(twitterdata.data[i]);
        } else {
            for(let j = 0; j < twitterdata.includes.media.length; j++){
                if (twitterdata.data[i].attachments.media_keys == twitterdata.includes.media[j].media_key && twitterdata.includes.media[j].hasOwnProperty("preview_image_url")){
                    displaywithImage(twitterdata.data[i], twitterdata.includes.media[j].preview_image_url);
                }
            }
        }
    }
    const endoftweets = {text:"Keine weiteren Tweets mit dem Suchbegriff " + "\"" + queryparam + "\""};
    displayTweet(endoftweets);
}

// Anzeigen von Tweets auf Webseite
function displayTweet(t){  
    innerwrapper = document.getElementById("innerwrapper");
    const tweets = document.createElement("article");
    tweets.className = "bg-primary text-white card tweet"
    innerwrapper.appendChild(tweets);
    tweets.innerText = t.text;
}

// Anzeigen von Tweets mit Foto
function displaywithImage(text, image){
    innerwrapper = document.getElementById("innerwrapper");
    const tweets = document.createElement("article");
    tweets.className = "bg-primary text-white card tweet"
    innerwrapper.appendChild(tweets);
    let img = "<img src=\""+image+"\"width=\"200px\" height=\"300px\"/>"
    tweets.innerHTML = text.text + img;
}