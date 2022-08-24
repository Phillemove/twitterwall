"use strict";

let confirmpassword;
let user = {
    "username": "",
    "password": ""
}

document.addEventListener("DOMContentLoaded", init);

// Startfunktion
function init(){
    // Storages leeren bei laden der Seite
    sessionStorage.clear();
    localStorage.clear();
        
    document.getElementById("login").addEventListener("click", login);
    document.getElementById("register").addEventListener("click", showformregister);
}

// Funktion für Login
function login(){
    user.username = document.getElementById("username").value;
    user.password = document.getElementById("password").value;
    document.getElementById("username").value = "";
    document.getElementById("password").value = "";
    
    if (user.username != "" && user.password != ""){
        requestlogin();
    } else {
        document.getElementById("errorcode").innerText = "Falsche Eingaben";
    } 
}

// Login Request an Server
async function requestlogin(){
    let response = await fetch("/login", { method: 'GET', headers: {'Authorization': 'Basic ' + btoa(user.username + ":" + user.password)}});
    if (response.status == 200){
        sessionStorage.setItem("Username", user.username);
        let data = await response.json();
        postlogin(data);
    } else { 
        let responsetext = await response.text();
        // Fehlermeldungen in Browser Konsole gewollt und können hier ignoriert werden.
        document.getElementById("errorcode").innerText = responsetext;
        setTimeout(function(){ document.getElementById("errorcode").innerText = " "; },3000);
    } 
}

// Suchhistorie von Nutzer in localStorage schreiben sofern vorhanden und weiterleitung zu search.html
function postlogin(data){
    if (data.searchterm != null) {
        for(let i = 0; i < data.searchterm.length; i++){
            localStorage.setItem(data.searchterm[i], data.searchterm[i]);
        } 
    }
    window.location.href = "search.html"; 
}

// Anzeigen oder Ausblenden Registrierungsformular
function showformregister(){
    let remove = document.getElementById("registerform");
    if (remove != null){
        remove.remove();
    } else {
        formregister();
    }
}
 
// Registrierungsformular in DOM erstellen
function formregister(){
    const wrapper = document.getElementById("wrapper") 
    const registerform = document.createElement("article");
    registerform.className = "bg-primary text-white card";
    wrapper.appendChild(registerform);
    registerform.id = "registerform";
    const formtext = document.createElement("span");
    formtext.id = "formtext";
    formtext.innerText = "Registrierung:";
    const formuser = document.createElement("input");
    formuser.type = "text";
    formuser.id = "formuser";
    formuser.placeholder = "Username";
    const formpassword = document.createElement("input");
    formpassword.type = "password";
    formpassword.id = "formpassword";
    formpassword.placeholder = "Password";
    const formpasswordconfirm = document.createElement("input");
    formpasswordconfirm.type = "password";
    formpasswordconfirm.id = "formpasswordconfirm";
    formpasswordconfirm.placeholder = "Confirm Password";
    const formsubmit = document.createElement("button");
    formsubmit.id = "registersubmit";
    formsubmit.className = "btn btn-light";
    formsubmit.type = "button";
    formsubmit.innerText = "Registrieren";
    formsubmit.addEventListener("click", register);
    registerform.appendChild(formtext);
    registerform.appendChild(formuser);
    registerform.appendChild(formpassword);
    registerform.appendChild(formpasswordconfirm);
    registerform.appendChild(formsubmit);
}

// Funktion für Registrierung
function register(){
    user.username = document.getElementById("formuser").value;
    user.password = document.getElementById("formpassword").value;
    confirmpassword = document.getElementById("formpasswordconfirm").value;
    document.getElementById("formuser").value = "";
    document.getElementById("formpassword").value = "";
    document.getElementById("formpasswordconfirm").value = "";
    if (user.password == confirmpassword){
        document.getElementById("formtext").innerText = "Registrierung:"
        requestregister();
    } else {
        document.getElementById("formtext").innerText = "Registrierung: \n Passwörter stimmen nicht überein!"
        setTimeout(function(){ document.getElementById("formtext").innerText = "Registrierung: "; },3000);
    }
}

// Registrierungsrequest an Server
async function requestregister(){   
    let response = await fetch("/register", { method: 'GET', headers: {'Authorization': 'Basic ' + btoa(user.username + ":" + user.password)}});
    if (response.status == 200){
        sessionStorage.setItem("Username", user.username);
        window.location.href = "search.html";
    } else {
        let responsetext = await response.text();
        // Fehlermeldungen in Browser Konsole gewollt und können hier ignoriert werden.
        document.getElementById("formtext").innerText = "Registrierung: \n " + responsetext;
        setTimeout(function(){ document.getElementById("formtext").innerText = "Registrierung: "; },3000);
    } 
}