<?php
// Display all errors for development (disable in production)
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Database config
$host = "localhost";
$db = "PrimeDB";
$user = "root";
$password = "";

// Connect to MySQL
$conn = new mysqli($host, $user, $password, $db);
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// Validate and sanitize POST data
$first_name = trim($_POST['first_name'] ?? '');
$last_name = trim($_POST['last_name'] ?? '');
$email = trim($_POST['email'] ?? '');
$phone = trim($_POST['phone'] ?? '');
$message = trim($_POST['message'] ?? '');

if (
    empty($first_name) || empty($last_name) ||
    empty($email) || empty($phone) || empty($message)
) {
    die("All fields are required.");
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    die("Invalid email format.");
}

// Escape inputs to prevent SQL injection
$first_name = $conn->real_escape_string($first_name);
$last_name = $conn->real_escape_string($last_name);
$email = $conn->real_escape_string($email);
$phone = $conn->real_escape_string($phone);
$message = $conn->real_escape_string($message);

// Insert into USER table
$sql = "INSERT INTO USER (FirstName, LastName, Email, PhoneNumber, Message, IsAdmin)
        VALUES ('$first_name', '$last_name', '$email', '$phone', '$message', FALSE)";

if ($conn->query($sql) === TRUE) {
    echo "Thank you for your message!";
} else {
    if ($conn->errno == 1062) {
        echo "This email is already registered.";
    } else {
        echo "Error: " . $conn->error;
    }
}

$conn->close();
?>
