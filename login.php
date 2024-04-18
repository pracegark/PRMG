<?php
// Assuming you have predefined username and password
$valid_username = "your_username";
$valid_password = "your_password";

// Retrieve username and password from the form
$username = $_POST['username'];
$password = $_POST['password'];

// Check if username and password match
if ($username === $valid_username && $password === $valid_password) {
    // Authentication successful, redirect to the contact form
    header("Location: contact_form.php");
    exit();
} else {
    // Authentication failed, redirect back to the login page
    header("Location: login.html");
    exit();
}
?>