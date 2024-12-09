// public/script.js
document.getElementById("image-upload-form").addEventListener("submit", function(event) {
  event.preventDefault();

  const formData = new FormData();
  const username = document.getElementById("user").value;
  formData.append("user", username); // Benutzername hinzufügen

  const frontImage = document.getElementById("front").files[0];
  const backImage = document.getElementById("back").files[0];

  if (frontImage) formData.append("front", frontImage);
  if (backImage) formData.append("back", backImage);

  fetch("/daily_upload", {
    method: "POST",
    body: formData,
  })
  .then(response => response.json())
  .then(data => {
    if (data.error) {
      alert("Fehler: " + data.error);
    } else {
      alert("Bilder erfolgreich hochgeladen!\n" + 
            "Vorderbild: " + data.files.front + "\n" + 
            "Rückbild: " + data.files.back + "\n" + 
            "Datum: " + data.date + "\n" + 
            "Uhrzeit: " + data.time);
    }
  })
  .catch(error => {
    alert("Fehler beim Hochladen der Bilder: " + error.message);
  });
});
