<?php
// Assuming you have predefined username and password
$valid_username = "jcastillo@primermg.com";
$valid_password = "Prime#2025";

// Retrieve username and password from the form
$username = $_POST['username'];
$password = $_POST['password'];

// Check if username and password match
if ($username === $valid_username && $password === $valid_password) {
    $_SESSION['isJuan'] = $true;
    // Authentication successful, redirect to the contact form
    header("Location: index.html");
    exit();
} else {
    // Authentication failed, redirect back to the login page
    $_SESSION['isJuan'] = false;
    header("Location: login.html");
    exit();
}
?>