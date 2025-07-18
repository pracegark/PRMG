
function checkLogin(pageName) {
    const user = localStorage.getItem("loggedInUser");

    if (user) {
            document.getElementById("loginButton").style.display = "none"
        
    } else
        if ((pageName = 'index') || (pageName = '')) {
            document.getElementById("logout").style.display="none"
        } else if (pageName = 'addJob') {
            document.getElementById("logout").style.display="none"
            document.getElementById("add-job-section").style.display="none"
        } else if (pageName = 'jobSeeker') {
            document.getElementById("logout").style.display="none"
            document.getElementById("export-btn").style.display = "none"
        }
}

function addJobLogin() {
    const user = localStorage.getItem
}

function login(username) {
    localStorage.setItem("loggedInUser", username);
    window.location.href = "index.html"; // Redirect after login
}

function logout() {
    localStorage.removeItem("loggedInUser");
    window.location.href = "login.html"; // Redirect after logout
}

function copyLink() {
    // Get the current page URL
    var url = window.location.href;

    // Create a temporary textarea element
    var textarea = document.createElement("textarea");
    textarea.value = url;

    // Append the textarea to the body
    document.body.appendChild(textarea);

    // Select the text within the textarea
    textarea.select();

    try {
        // Copy the selected text to the clipboard
        var successful = document.execCommand("copy");

        if (successful) {
            alert("Link copied to clipboard: " + url);
        } else {
            alert("Copy link failed. Please try again.");
        }
    } catch (error) {
        console.error("Unable to copy link:", error);
        alert("Copy link failed. Please try again.");
    }

    // Remove the temporary textarea
    document.body.removeChild(textarea);
}

        function exportToExcel() {
            // Collect form data
            var formData = new FormData(document.getElementById('contact-form'));
            var jsonData = {};
            formData.forEach(function(value, key){
                jsonData[key] = value;
            });

            // Convert JSON to CSV
            var csv = 'Name,Email,Message,Resume\n';
            csv += jsonData.name + ',' + jsonData.email + ',' + jsonData.message + ',' + jsonData.resume.name + '\n'; // Assuming resume is a file input

            // Create a blob
            var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });

            // Create download link
            var link = document.createElement("a");
            if (link.download !== undefined) {
                var url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", "contact_info.csv");
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        }

document.addEventListener("DOMContentLoaded", checkLogin);