
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
