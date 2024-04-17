<?php
// Get form data
$name = $_POST['name'];
$email = $_POST['email'];

// File upload handling
$file_name = $_FILES['resume']['name'];
$file_tmp_name = $_FILES['resume']['tmp_name'];
$file_type = $_FILES['resume']['type'];
$file_size = $_FILES['resume']['size'];

// Set destination email address
$to = 'pracegarker@gmail.com';

// Set email subject
$subject = $name . ' has sent you their resume';

// Set email message
$message = "Name: $name\n";
$message .= "Email: $email\n\n";
$message .= "Please find the resume attached.";

// Set headers for attachment
$headers = "From: $email" . "\r\n";
$headers .= "MIME-Version: 1.0" . "\r\n";
$headers .= "Content-Type: multipart/mixed; boundary=\"boundary\"\r\n";

// Read file content
$file_content = file_get_contents($file_tmp_name);

// Base64 encode attachment
$attachment = chunk_split(base64_encode($file_content));

// Set boundary
$boundary = "--boundary";

// Set message body
$body = "$boundary\r\n";
$body .= "Content-Type: text/plain; charset=ISO-8859-1\r\n";
$body .= "Content-Transfer-Encoding: 7bit\r\n\n";
$body .= "$message\r\n\n";

$body .= "$boundary\r\n";
$body .= "Content-Type: application/pdf; name=\"$file_name\"\r\n";
$body .= "Content-Transfer-Encoding: base64\r\n";
$body .= "Content-Disposition: attachment; filename=\"$file_name\"\r\n\n";
$body .= "$attachment\r\n";
$body .= "$boundary--";

// Send email
if (mail($to, $subject, $body, $headers)) {
    echo "Email sent successfully.";
} else {
    echo "Error sending email.";
}
?>
