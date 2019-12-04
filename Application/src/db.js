import Firebase from '@firebase/app';
import '@firebase/database';

 let config = {
    apiKey: "AIzaSyA3jcy7S5s68VIVCXwhHaX8aW6UfEZYnYE",
    authDomain: "arduino-esp.firebaseapp.com",
    databaseURL: "https://arduino-esp.firebaseio.com",
    projectId: "arduino-esp",
    storageBucket: "arduino-esp.appspot.com",
    messagingSenderId: "1000499094893",
  };
let app = Firebase.initializeApp(config);
export const db = app.database();