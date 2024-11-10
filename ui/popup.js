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

// Function to check if the user is logged in
function checkLogin(tab) {
  chrome.tabs.sendMessage(
    tab.id,
    { action: "checkLogin" },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error("Message sending failed:", chrome.runtime.lastError);
        const errorContent = document.getElementById("error-content");
        const errorDate = document.getElementById("error-timestamp");
        errorContent.style.display = "block";
        errorDate.textContent = getFormattedDateTime().split('.')[0];
        return;
      }
      if (response && response.loggedIn) {
        console.log("WhatsApp is logged in.");
        chrome.storage.local.get("login", (result)=>{
          if (result.login === false) {
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
              chrome.storage.local.set({ login: true });
              console.log("Request sent:", response);
              const mainContent = document.getElementById("main-content");
              mainContent.style.display = "block";
              
            } else {
              console.error("Error:", response.statusText);
            }
          })
          .catch((error) => {
            console.error("Error:", error);
          });
          }
          else {
            // TODO: Add a get call in service to ensure that the service is logged in
            const mainContent = document.getElementById("main-content");
            mainContent.style.display = "block";
          }
        })
      } else {
        console.log("Not logged in. Sending request to server...");
        setTimeout(() => checkLogin(tab), 1000);
        chrome.storage.local.set({ login: false });
      }
    }
  );
}

// Call the checkWhatsAppLogin function to start the process
checkWhatsAppLogin();


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
  sendButton.classList.remove("btn-danger");
  sendButton.classList.remove("btn-primary");
  sendButton.classList.add("btn-success");
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
      sendButton.classList.remove("btn-danger");
      sendButton.classList.add("btn-primary");
      sendButton.innerHTML = "New Broadcast";
    } else {
      throw new Error("Failed to process the file");
    }
  } catch (error) {
    // Set the progress bar width to 100% and indicate error
    sendButton.removeChild(spinnerElement);
    sendButton.innerHTML = "Re-Broadcast";
    sendButton.classList.remove("btn-primary");
    sendButton.classList.add("btn-danger");
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
  statusCell.textContent = phoneStatus.status;

  // Create the green and red ticks
  const greenTick = document.createElement('span');
  greenTick.classList.add('green-tick');

  const redTick = document.createElement('span');
  redTick.classList.add('red-tick');

  // Set visibility based on the status
  if (phoneStatus.status === 'success') {
    greenTick.style.visibility = 'visible'; // Show the green tick
  } else if (phoneStatus.status === 'fail') {
    redTick.style.visibility = 'visible'; // Show the red tick
  }

  // Append the ticks to the status cell
  statusCell.appendChild(greenTick);
  statusCell.appendChild(redTick);

  const scheduleCell = document.createElement('td');
  scheduleCell.textContent = phoneStatus.schedule;

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

    result.phone_status.forEach(phoneStatus => {
      tableBody.appendChild(createRow(phoneStatus));
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