// Function to check if WhatsApp Web is logged in
function checkWhatsAppLogin() {
  chrome.tabs.query({ url: "https://web.whatsapp.com/*" }, (tabs) => {
    if (tabs.length === 0) {
      // Open WhatsApp Web in a new tab
      chrome.tabs.create({ url: "https://web.whatsapp.com/" }, (tab) => {
        // Start checking for login status
        checkLogin(tab);
      });
    } else {
      // Start checking for login status
      checkLogin(tabs[0]);
    }
  });
}

function updateErrorDialog(visibility=true, title=null, description=null, workaround_name=null, workaround=null) {
  const errorContent = document.getElementById("error-content");
  const errorDate = document.getElementById("error-timestamp");
  const errorTitle = document.getElementById("error-title");
  const errorDescription = document.getElementById("error-description");
  const errorWorkaroundButton = document.getElementById("error-workaround-button");

  if (!visibility) {
    errorContent.style.display = "none";
  }
  else {
    errorContent.style.display = "block";
  }
  
  errorDate.textContent = getFormattedDateTime().split('.')[0];
  if (title){
    errorTitle.textContent = title;
  } 
  if (description){
    errorDescription.textContent = description;
  }
  if (workaround_name){
    errorWorkaroundButton.textContent = workaround_name;
  }
  if (workaround) {
    errorWorkaroundButton.onclick = startLogin;
  }
}

function toggleLoginCheck(display) {
  const loginCheck = document.getElementById("spinner-container");
  console.log(display);
  loginCheck.style.display = display;
}

function startLogin() {
  const errorContent = document.getElementById("error-content");
  errorContent.style.display = "none";
  toggleLoginCheck("block");
  const mainContent = document.getElementById("main-content");
  // Send request to server to check if user is logged in
  fetch("http://127.0.0.1:5000/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message: "WhatsApp is not logged in" })
  })
  .then((response) => {
    if (response.ok) {
      toggleLoginCheck("none");
      chrome.storage.local.set({ login: true });
      console.log("Request sent:", response);
      
      mainContent.style.display = "block";
      updateErrorDialog(visibility=false);
    } else {
      toggleLoginCheck("none");
      mainContent.style.display = "none";
      console.error("Error:", response.statusText);
      chrome.storage.local.set({ login: false });
      updateErrorDialog(true, "Unauthorized", "Whatsapp web is not loggedin. Please login to continue using the extension.", "Login", "https://web.whatsapp.com/")
      console.log("Not logged in. Sending request to server...");
    }
  })
  .catch((error) => {
    toggleLoginCheck("none");
    mainContent.style.display = "none";
    chrome.storage.local.set({ login: false });
    updateErrorDialog(true, "Unauthorized", "Whatsapp web is not loggedin. Please login to continue using the extension.", "Login", "https://web.whatsapp.com/")
    console.error("Error:", error);
  });
}

// Function to check if the user is logged in
function tryLogin(background=false) {
  if (!background) {
    toggleLoginCheck("block");
  }
  
  const mainContent = document.getElementById("main-content");
  fetch("http://127.0.0.1:5000/login", {
    method: "GET"
  })
  .then((response) => {
    if (response.ok) {
      chrome.storage.local.set({ login: true });
      console.log("Request sent:", response);
      
      mainContent.style.display = "block";
      toggleLoginCheck("none");
      updateErrorDialog(visibility=false);
    } else {
      toggleLoginCheck("none");
      toggleLoginCheck("none");
      mainContent.style.display = "none";
      chrome.storage.local.set({ login: false });
      console.error("Error:", response.statusText);
      updateErrorDialog(true, "Unauthorized", "Whatsapp web is not loggedin. Please login to continue using the extension.", "Login", "https://web.whatsapp.com/")
      console.log("Not logged in. Sending request to server...");
    }})
    .catch((error) => {
      toggleLoginCheck("none");
      mainContent.style.display = "none";
      chrome.storage.local.set({ login: false });
      console.log("Here");
      updateErrorDialog(true, "Unauthorized", "Whatsapp web is not loggedin. Please login to continue using the extension.", "Login", "https://web.whatsapp.com/")
      console.error("Error:", error);
    });
}

// Call the checkWhatsAppLogin function to start the process
//checkWhatsAppLogin();

chrome.storage.local.get(response => {
  if (response.login === false) {
    tryLogin();
  }
  else {
    toggleLoginCheck("none");
    const mainContent = document.getElementById("main-content");
    mainContent.style.display = "block";
    updateErrorDialog(visibility=false);
  }
});


tryLogin(background=true);
let settingsModal = '';
document.getElementById("settings").addEventListener("click", async (event) => {
  console.log("Settings opened");
  // Show modal
  const key = document.getElementById("keyInput");
  const inqpathInput = document.getElementById("inqpathInput");
  const sheetName = document.getElementById("sheetNameInput");
  const browserTimeout = document.getElementById("browserTimeoutInput");
  settingsModal = new bootstrap.Modal(document.getElementById("settings-form"));
  response = await fetch("http://127.0.0.1:5000/settings", {
    method: "GET"}
  );
  response = await response.json()
  console.log(response["gjson"])
  key.value = response["gjson"];
  inqpathInput.value = response["inqpath"];
  sheetName.value = response["sheet_name"];
  browserTimeout.value = response["browser_timeout"];
  settingsModal.show();
})

document.getElementById("save-settings").addEventListener("click", async (event) => {
  const gjson = document.getElementById("keyInput").value;
  const inqpath = document.getElementById("inqpathInput").value;
  const sheetname = document.getElementById("sheetNameInput").value;
  const browsertimeout = document.getElementById("browserTimeoutInput").value;
  const formData = new FormData();
  formData.append("gjson", gjson)
  formData.append("inqpath", inqpath)
  formData.append("sheet_name", sheetname);
  formData.append("browser_timeout", browsertimeout);
  response = await fetch("http://127.0.0.1:5000/settings", {
    method: "POST",
    body: formData}
  );
  response = await response.json()
  settingsModal.hide();
})

// Toggle schedule section visibility
document.getElementById("enable-schedule").addEventListener("change", (event) => {
  console.log("enable-schedule option is changed");
  const scheduleOptions = document.getElementById("schedule-options");
  const sendButton = document.getElementById("send");

  if (event.target.checked) {
    scheduleOptions.classList.remove("d-none");  // Show schedule options
  } else {
    scheduleOptions.classList.add("d-none");  // Hide schedule options
  }
});

document.getElementById("localSheet").addEventListener('change', (event) => {
  console.log("checked ", event)
  if (event.target.checked) {
    document.getElementById("googleSheetContainer").style.display = "none";
    document.getElementById("googleUrl").value = "";
    document.getElementById("localSheetContainer").style.display = "block";
  }
});

document.getElementById("googleSheet").addEventListener('change', (event) => {
  console.log("checked ", event)
  if (event.target.checked) {
    document.getElementById("localSheetContainer").style.display = "none";
    document.getElementById("file").value = "";
    document.getElementById("googleSheetContainer").style.display = "block";
  }
})


function getFormattedDateTime() {
  const now = new Date();
  
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');  // Months are 0-indexed
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const milliseconds = String(now.getMilliseconds());  // Milliseconds padded to 3 digits
  
  // Generate the formatted string
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}000000`;
}

document.getElementById("send").addEventListener("click", async () => {
  let is_local_source = true;
  const message = document.getElementById("message").value;
  const fileInput = document.getElementById("file");
  const fileUrl = document.getElementById("googleUrl");

  if (!message || (fileInput.files.length === 0 && fileUrl.value === "")) {
    alert("Please enter a message and provide a file.");
    return;
  }

  if (fileInput.files.length === 0) {
    is_local_source = false;
  }
  

  let selectedDateTime = document.getElementById('datetime').value;
  // If the user hasn't selected a date, use the current date and time
  if (!selectedDateTime) {
    selectedDateTime = getFormattedDateTime();
  } else {
    // If the user has selected a date, convert the 'datetime-local' format to the desired format
    const dateObj = new Date(selectedDateTime);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const seconds = String(dateObj.getSeconds()).padStart(2, '0');
    const milliseconds = String(dateObj.getMilliseconds());

    // Format the datetime to YYYY-MM-DD HH:mm:ss.ssssss
    selectedDateTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}000000`;
  }

  let frequency = document.getElementById("schedule").value;

  console.log("Data to be send ", message, fileInput.files, selectedDateTime, frequency);


  // Prepare the FormData object to send the file
  const formData = new FormData();
  if (is_local_source){
    const file = fileInput.files[0];
    formData.append("file", file);
  }
  else {
    formData.append("file", fileUrl.value);
  }
  
  formData.append("message", message);
  formData.append("schedule_at", selectedDateTime);
  formData.append("frequency", frequency);

  // Prepare the status list
  const sendButton = document.getElementById("send");
  sendButton.classList.remove("btn-outline-danger");
  sendButton.classList.remove("btn-outline-primary");
  //sendButton.classList.add("btn-success");
  sendButton.innerHTML = "Scheduling..."; // Clear previous statuses

  // Create the status item for the progress
  const spinnerElement = document.createElement("span");
  spinnerElement.className = "spinner-border spinner-border-sm";
  spinnerElement.role = "status";
  spinnerElement["aria-hidden"] = "true";

  // Append the status item to the status list
  sendButton.appendChild(spinnerElement);

  // Send the request to Flask server with the file
  try {
    let response = ""
    if (is_local_source) {
      response = await fetch("http://127.0.0.1:5000/send-with-file", {
      method: "POST",
      body: formData});
    }
    else {
    response = await fetch("http://127.0.0.1:5000/send-without-file", {
      method: "POST",
      body: formData});
    }

    const parsed_response = await response.json();
    console.log("Response: ", parsed_response);

    if (parsed_response.status === "success") {
      sendButton.removeChild(spinnerElement);
      sendButton.classList.remove("btn-outline-danger");
      sendButton.classList.add("btn-outline-primary");
      sendButton.innerHTML = "New Broadcast";
    } else {
      throw new Error("Failed to process the file");
    }
  } catch (error) {
    // Set the progress bar width to 100% and indicate error
    sendButton.removeChild(spinnerElement);
    sendButton.innerHTML = "Re-Broadcast";
    sendButton.classList.remove("btn-outline-primary");
    sendButton.classList.add("btn-outline-danger");
    console.error(error);

    const toastElement = document.getElementById("bcastToast");
    const toastTimeStamp = document.getElementById("toast-timestamp");
    toastTimeStamp.innerHTML = getFormattedDateTime().split('.')[0];

    toast = new bootstrap.Toast(toastElement, {
      animation: true,
      autohide: true,
      delay: 480000 // Wait for 8 minutes before hiding the toast
    });
    toast.show();
  }
});


function initializeStatus() {
  console.log("refreshing status");
  updateTable();  
}

// Function to create a table row
function createRow(phoneStatus) {
  const row = document.createElement('tr');
  const phoneCell = document.createElement('td');
  phoneCell.textContent = phoneStatus.phone_number;

  const statusCell = document.createElement('td');

  // Check status and set appropriate icon and background color
  const icon = document.createElement('i');
  if (phoneStatus.status === 'success') {
    icon.classList.add('bi', 'bi-check-circle-fill', 'bg-primary', 'status-icon');
  }
  else if (phoneStatus.status === 'progress') {
    icon.classList.add('spinner-grow', 'text-primary');
  } else {
    icon.classList.add('bi', 'bi-x-circle-fill', 'bg-danger', 'status-icon');
  }

  // Append the icon to the statusCell
  statusCell.appendChild(icon);

  const scheduleCell = document.createElement('td');
  scheduleCell.textContent = phoneStatus.next_schedule?.split('.')[0];

  row.appendChild(phoneCell);
  row.appendChild(statusCell);
  row.appendChild(scheduleCell);

  return row;
}

// Function to update the main table with the last 5 rows
async function updateTable() {
  const tableBody = document.getElementById('status-tbody');
  tableBody.innerHTML = ''; // Clear current rows


  try {
    const response = await fetch('http://127.0.0.1:5000/get-phone-status');
    const result = await response.json();

    table_size = 5
    result.phone_status.forEach(phoneStatus => {
      if (table_size > 0) {
        tableBody.appendChild(createRow(phoneStatus));
        table_size -= 1;
      }
      else {
        return;
      }
    });
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}


// Attach event listener to "View All" button
document.getElementById('viewAllBtn').addEventListener('click', function () {
  openModal();
});


// Open modal with all rows and make it scrollable
async function openModal() {
  const modalTbody = document.getElementById('modal-tbody');
  modalTbody.innerHTML = ''; // Clear current rows in the modal table

  try {
    const response = await fetch('http://127.0.0.1:5000/get-phone-status');
    const result = await response.json();

    result.phone_status.forEach(phoneStatus => {
      modalTbody.appendChild(createRow(phoneStatus));
    });
  } catch (error) {
    console.error('Error fetching data:', error);
  }

  // Show modal
  const modal = new bootstrap.Modal(document.getElementById('detailsModal'));
  modal.show();
}

document.addEventListener("DOMContentLoaded", function() {
  // Your code here will run once the DOM is fully loaded
  // Example: initialize your tabs, buttons, etc.
  setInterval(initializeStatus, 5000);
});