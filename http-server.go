package main

import (
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"time"

	"gopkg.in/mgo.v2"
	"gopkg.in/mgo.v2/bson"
)

// Struct für aufbereitete Daten von Twitter (Tweets)
// Für einpflegen in DB
// Struct tweet wurde kopiert und angepasst
type tweet struct {
	Searchterm string `bson:"searchterm"`
	Timestamp  int64  `bson:"timestamp"`
	Data       []struct {
		ID          string `bson:"id" json:"id"`
		Text        string `bson:"text" json:"text"`
		Attachments struct {
			MediaKeys []string `bson:"media_keys" json:"media_keys"`
		} `bson:"attachments,omitempty" json:"attachments,omitempty"`
	} `bson:"data" json:"data"`
	Includes struct {
		Media []struct {
			MediaKey        string `bson:"media_key" json:"media_key"`
			PreviewImageURL string `bson:"preview_image_url,omitempty" json:"preview_image_url,omitempty"`
		} `bson:"media" json:"media"`
	} `bson:"includes" json:"includes"`
}

// Für Auslesen aus DB
type tweetDB struct {
	ID         bson.ObjectId `bson:"_id"`
	Searchterm string        `bson:"searchterm"`
	Timestamp  int64         `bson:"timestamp"`
	Data       []struct {
		ID          string `bson:"id" json:"id"`
		Text        string `bson:"text" json:"text"`
		Attachments struct {
			MediaKeys []string `bson:"media_keys" json:"media_keys"`
		} `bson:"attachments,omitempty" json:"attachments,omitempty"`
	} `bson:"data" json:"data"`
	Includes struct {
		Media []struct {
			MediaKey        string `bson:"media_key" json:"media_key"`
			PreviewImageURL string `bson:"preview_image_url,omitempty" json:"preview_image_url,omitempty"`
		} `bson:"media" json:"media"`
	} `bson:"includes" json:"includes"`
}

// Struct für Nutzerverwaltung
type user struct {
	Username string `bson:"username" json:"username"`
	Password string `bson:"password" json:"password"`
}

type userDB struct {
	ID       bson.ObjectId `bson:"_id"`
	Username string        `bson:"username" json:"username"`
	Password string        `bson:"password" json:"password"`
}

// Struct für Suchhistorie/Suchliste
type history struct {
	Username   string   `bson:"username" json:"username"`
	Searchterm []string `bson:"searchterm" json:"searchterm"`
}

type historydb struct {
	ID         bson.ObjectId `bson:"_id"`
	Username   string        `bson:"username" json:"username"`
	Searchterm []string      `bson:"searchterm" json:"searchterm"`
}

// Variablen für Twitterdaten, Nutzer & Suchhistorie
var twitterdata tweet
var twitterdataDB tweetDB
var usr user
var userdb userDB
var searchtermhistory history
var searchtermhistorydb historydb

func main() {
	http.Handle("/", http.FileServer(http.Dir(".")))
	http.HandleFunc("/search", search)
	http.HandleFunc("/login", login)
	http.HandleFunc("/register", register)
	http.HandleFunc("/history", searchhistory)
	fmt.Printf("Starting Server at Port 9000 \n")
	http.ListenAndServe(":9000", nil)
}

// Response Funktion für Search
func search(w http.ResponseWriter, r *http.Request) {

	// Query Parameter aus Request URL auslesen und in String umwandeln
	queryparam := r.URL.Query()["query"]
	querystring := string(queryparam[0])

	// Nutzernamen aus Request Body auslesen und in usr speichern
	body, err := ioutil.ReadAll(r.Body)
	check(err)
	usr = user{}
	json.Unmarshal(body, &usr)

	// Datenbanksession herstellen
	dbsession, _ := mgo.Dial("localhost:27017")
	defer dbsession.Close()

	// Nutzer Prüfen, ob er Registriert ist (Berechtigung Suche durchzuführen)
	coll := dbsession.DB("Twitterwall").C("Users")
	query := bson.M{"username": usr.Username}
	coll.Find(query).One(&userdb)
	// Wenn vorhanden/berechtigt Suche durchführen
	if userdb.Username == usr.Username {
		// Suche in DB nach Twittersuchbegriff inklusive Zeit auslesen
		coll = dbsession.DB("Twitterwall").C("Search")
		query = bson.M{"searchterm": querystring}
		twitterdataDB = tweetDB{}
		coll.Find(query).One(&twitterdataDB)
		timenow := time.Now()
		nowsec := timenow.Unix()
		// Tatsächliche Anfrage an Twitter bei einem der folgenden Fälle
		if twitterdataDB.ID == "" {
			requestsearch(querystring)
			_ = coll.Insert(&twitterdata)
			coll.Find(query).One(&twitterdataDB)
		} else if (nowsec - twitterdataDB.Timestamp) > 300 {
			coll.Remove(query)
			requestsearch(querystring)
			_ = coll.Insert(&twitterdata)
			coll.Find(query).One(&twitterdataDB)
		}

		// Response von Tweets
		rs, err := json.Marshal(twitterdataDB)
		check(err)
		w.Header().Set("Content-Type", "application/json")
		w.Write(rs)
	} else {
		// Response falls Nutzer nicht Registriert
		w.WriteHeader(403)
		fmt.Fprintln(w, "Unautorisierter Nutzer")
	}
}

// Führt Request an Search Endpoint von TwitterAPI durch
func requestsearch(querystring string) {

	// Bearertoken aus externer Datei einlesen
	bearer, err := ioutil.ReadFile("bearer.txt")
	check(err)

	// Die folgenden 6 Code-Zeilen wurden kopiert und angepasst
	req, err := http.NewRequest("GET", "https://api.twitter.com/2/tweets/search/recent?query="+querystring+"&expansions=attachments.media_keys&media.fields=preview_image_url", nil)
	check(err)
	req.Header.Set("Authorization", os.ExpandEnv("Bearer "+string(bearer)))

	resp, err := http.DefaultClient.Do(req)
	check(err)
	defer resp.Body.Close()

	// Auslesen Request.body
	body, err := ioutil.ReadAll(resp.Body)
	check(err)

	// aktuelle Zeit in Sec auslesen
	now := time.Now()
	sec := now.Unix()

	// Speichern und parsen von Bodydaten in Variable twitterdata + hinzufügen von Searchterm und Timestamp händisch
	// Inhalt von twitterdata leeren vor neuem Befüllen -> Elemente bleiben sonst erhalten, die nicht dazu gehören
	twitterdata = tweet{}
	twitterdata = tweet{Searchterm: querystring, Timestamp: sec}
	json.Unmarshal(body, &twitterdata)
}

// Funktion für Nutzerlogin
func login(w http.ResponseWriter, r *http.Request) {

	// Nutzerdaten aus Request auslesen
	loguser, logpass, _ := r.BasicAuth()
	usr = user{}
	usr = user{Username: loguser}
	// Hashen des Passwortes
	usr.Password = hashpassword(logpass)

	// Datenbanksession herstellen, Nutzer suchen
	dbsession, _ := mgo.Dial("localhost:27017")
	defer dbsession.Close()
	coll := dbsession.DB("Twitterwall").C("Users")
	query := bson.M{"username": usr.Username}
	userdb = userDB{}
	coll.Find(query).One(&userdb)
	if userdb.Username == "" {
		// Response Nutzer nicht registriert
		w.WriteHeader(404)
		fmt.Fprintln(w, "Nutzername nicht bekannt")
	} else if usr.Password == userdb.Password {
		// Response Nutzer und Passwort passt. Auslessen Suchhistorie zu diesem Nutzer
		coll = dbsession.DB("Twitterwall").C("History")
		searchtermhistorydb = historydb{}
		coll.Find(query).One(&searchtermhistorydb)
		// Response der Suchhistorie des Nutzers
		rs, err := json.Marshal(searchtermhistorydb)
		check(err)
		w.WriteHeader(200)
		w.Header().Set("Content-Type", "application/json")
		w.Write(rs)
	} else {
		// Response falsches Passwort
		w.WriteHeader(403)
		fmt.Fprintln(w, "Passwort ist falsch")
	}

}

// Funktion für Registrierung
func register(w http.ResponseWriter, r *http.Request) {

	// Userdaten aus Request auslesen und in usr Speichern
	reguser, regpass, _ := r.BasicAuth()
	usr = user{}
	usr = user{Username: reguser}
	// Hashen des Passwortes
	usr.Password = hashpassword(regpass)

	// Datenbanksession herstellen und Nutzer in DB speichern
	dbsession, _ := mgo.Dial("localhost:27017")
	defer dbsession.Close()
	coll := dbsession.DB("Twitterwall").C("Users")
	query := bson.M{"username": usr.Username}
	userdb = userDB{}
	coll.Find(query).One(&userdb)
	// Prüfen auf doppelten Nutzernamen und dementsprechender Response
	if userdb.Username == "" {
		_ = coll.Insert(&usr)
		w.WriteHeader(200)
		fmt.Fprintln(w, "Registrierung erfolgreich")
	} else {
		w.WriteHeader(460)
		fmt.Fprintln(w, "Nutzername bereit vorhanden")
	}

}

// Speichern von Suchhistorie
func searchhistory(w http.ResponseWriter, r *http.Request) {

	// Suchhistorie aus Request auslesen und in searchtermhistory speichern
	body, err := ioutil.ReadAll(r.Body)
	check(err)
	searchtermhistory = history{}
	json.Unmarshal(body, &searchtermhistory)

	// DB-Session herstellen
	dbsession, _ := mgo.Dial("localhost:27017")
	defer dbsession.Close()
	// Prüfen ob es sich um registrierten User handelt
	coll := dbsession.DB("Twitterwall").C("Users")
	query := bson.M{"username": searchtermhistory.Username}
	userdb = userDB{}
	coll.Find(query).One(&userdb)
	if searchtermhistory.Username == userdb.Username {
		// Prüfen, ob Eintrag bereits vorhanden ist, wenn ja -> Updaten, wenn nein -> neu anlegen
		coll = dbsession.DB("Twitterwall").C("History")
		searchtermhistorydb = historydb{}
		coll.Find(query).One(&searchtermhistorydb)
		if searchtermhistorydb.Username == "" {
			_ = coll.Insert(&searchtermhistory)
			w.WriteHeader(200)
			fmt.Fprintln(w, "Speichern erfolgreich")
		} else {
			coll.Remove(query)
			_ = coll.Insert(&searchtermhistory)
			w.WriteHeader(200)
			fmt.Fprintln(w, "Speichern erfolgreich")
		}

	} else {
		w.WriteHeader(403)
		fmt.Fprintln(w, "Unautorisierter Nutzer")
	}

}

// Funktion zum Hashen eines Strings/Passwortes
// Funktion wurde kopiert und angepasst
func hashpassword(password string) string {
	passwordhash := md5.Sum([]byte(password))
	return hex.EncodeToString(passwordhash[:])
}

// Funktion für Errorbehandlung
func check(e error) {
	if e != nil {
		log.Fatalln(e)
	}
}
