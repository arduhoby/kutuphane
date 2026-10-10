import sys
import requests
from PySide6.QtWidgets import QApplication, QLabel, QMainWindow, QVBoxLayout, QWidget, QLineEdit, QPushButton

from PySide6.QtGui import QPixmap

from PySide6.QtCore import Qt

class ImageViewerApp(QMainWindow):
    def __init__(self):
        super().__init__()

        self.setWindowTitle("Image Viewer")
        self.setGeometry(100, 100, 800, 600)

        main_widget = QWidget()
        layout = QVBoxLayout()

        self.url_input = QLineEdit()
        layout.addWidget(self.url_input)

        self.load_button = QPushButton("Load Image")
        self.load_button.clicked.connect(self.load_image)
        layout.addWidget(self.load_button)

        self.image_label = QLabel()
        self.image_label.setAlignment(Qt.AlignCenter)
        layout.addWidget(self.image_label)

        main_widget.setLayout(layout)
        self.setCentralWidget(main_widget)

    def load_image(self):
        url = self.url_input.text()
        response = requests.get(url)
        if response.status_code == 200:
            image_data = response.content
            pixmap = QPixmap()
            pixmap.loadFromData(image_data)
            self.image_label.setPixmap(pixmap)
            self.image_label.setScaledContents(True)
        else:
            self.image_label.setText("Failed to load image from URL")

if __name__ == "__main__":
    app = QApplication(sys.argv)
    
    viewer = ImageViewerApp()
    viewer.show()

    sys.exit(app.exec())
