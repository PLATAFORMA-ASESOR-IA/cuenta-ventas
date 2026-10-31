// Importa los SDKs necesarios de Firebase por CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// TODO: Reemplaza con tus credenciales de Firebase Console
<script type="module">
  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyDfBtklCYl-wugVA_FYgoZFyO9-fjedVSw",
    authDomain: "cuenta-ventas-cad56.firebaseapp.com",
    projectId: "cuenta-ventas-cad56",
    storageBucket: "cuenta-ventas-cad56.firebasestorage.app",
    messagingSenderId: "132116726660",
    appId: "1:132116726660:web:8983eea611491ada6c93d1"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
</script>

// Inicializar Firebase y Firestore
const app = initializeApp(firebaseConfig);
export const dbFirestore = getFirestore(app);
