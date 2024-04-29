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
$description = $_POST['description'];
$link = $_POST['link'];
$location = $_POST['location'];
$type = $_POST['type'];

// Prepare SQL statement
$sql = "INSERT INTO Job (name, description, link, location, type) VALUES ('$name', '$description', '$link', '$location', '$type')";

if ($conn->query($sql) === TRUE) {
    echo "New job added successfully";
} else {
    echo "Error: " . $sql . "<br>" . $conn->error;
}

$conn->close();
?>
