<?php
// Database connection
$servername = "localhost";
$username = "root";
$password = "";
$dbname = "PRMG";

// Create connection
$conn = new mysqli($servername, $username, $password, $dbname);

// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Retrieve form data
    $email = $_POST['email'];
    $jobs = isset($_POST['jobs']) ? 1 : 0; // If checkbox is checked, set to 1, else 0
    
    // Check if the email exists in the Contacts table
    $sql = "SELECT * FROM Contact WHERE email = '$email'";
    $result = mysqli_query($conn, $sql);

    if (mysqli_num_rows($result) > 0) {
        // Update getUpdates field for the email
        $updateSql = "UPDATE Contact SET getUpdates = $jobs WHERE email = '$email'";
        if (mysqli_query($conn, $updateSql)) {
            echo "Subscription updated successfully.";
        } else {
            echo "Error updating subscription: " . mysqli_error($conn);
        }
    } else {
        echo "Email not found in database.";
    }

    // Free result set
    mysqli_free_result($result);

    // Close connection
    mysqli_close($conn);
} else {
    echo "Invalid request method.";
}
?>
