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
// Fetch jobs from the database
$sql = "SELECT * FROM Job ORDER BY jobId DESC"; // Assuming jobId is the primary key
$result = mysqli_query($conn, $sql);

// Check if any jobs are available
if (mysqli_num_rows($result) > 0) {
    // Loop through each row in the result set
    while ($row = mysqli_fetch_assoc($result)) {
        // Display job details
        echo '<div>';
        echo '<h3>' . $row['name'] . '</h3>'; // Job Title
        echo '<p><strong>Location:</strong> ' . $row['location'] . '</p>'; // Job Location
        echo '<p><strong>Type:</strong> ' . $row['type'] . '</p>'; // Job Type
        echo '<p><strong>Description:</strong> ' . $row['description'] . '</p>'; // Job Description
        echo '<a href="' . $row['link'] . '">Apply Now</a>'; // Job Link
        echo '</div>';
    }
} else {
    echo '<p>No jobs available.</p>';
}

// Free result set
mysqli_free_result($result);

// Close connection
mysqli_close($conn);
?>
