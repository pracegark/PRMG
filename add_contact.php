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

// Gather data from POST request
$name = $_POST['name'];
$email = $_POST['email'];
$message = $_POST['message'];
$resume = $_POST['resume'];
$getUpdates = isset($_POST['getUpdates']) ? $_POST['getUpdates'] : 0;

// Prepare SQL statement
$sql = "INSERT INTO Contact (name, email, message, resume, getUpdates) VALUES ('$name', '$email', '$message', '$resume', '$getUpdates')";

if ($conn->query($sql) === TRUE) {
    echo "New contact added successfully";
} else {
    echo "Error: " . $sql . "<br>" . $conn->error;
}

$conn->close();
?>
