<?php
session_start();
$uid = $_GET['uid'] ?? $_SESSION['hashtag_uid'] ?? 1;
?>
<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <title>Meu Avatar 3D - Rede Social</title>
    <style>
        body, html { margin: 0; padding: 0; height: 100%; overflow: hidden; background: #87ceeb; }
        iframe { width: 100%; height: 100%; border: none; }
        .back-link { position: absolute; top: 10px; left: 10px; z-index: 100; background: white; padding: 5px 10px; border-radius: 5px; text-decoration: none; color: #333; font-family: sans-serif; }
    </style>
</head>
<body>
    <a href="index.php" class="back-link">← Voltar para a Rede Social</a>
    <!-- O iframe aponta para a pasta onde o build será colocado -->
    <iframe src="avatar-3d/index.html?uid=<?php echo $uid; ?>"></iframe>
</body>
</html>
