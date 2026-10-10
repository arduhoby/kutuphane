import sys
from PySide6.QtCore import Qt
from PySide6.QtWidgets import QApplication, QMainWindow, QListWidget, QLineEdit, QVBoxLayout, QWidget, QPushButton

class MyWindow(QMainWindow):
    def __init__(self):
        super().__init__()

        self.setWindowTitle("ListView Example")
        self.setGeometry(100, 100, 400, 300)

        central_widget = QWidget(self)
        self.setCentralWidget(central_widget)

        layout = QVBoxLayout()

        self.list_widget = QListWidget(self)
        layout.addWidget(self.list_widget)

        self.line_edit = QLineEdit(self)
        layout.addWidget(self.line_edit)

        remove_button = QPushButton("Remove Selected", self)
        remove_button.clicked.connect(self.remove_selected_item)
        layout.addWidget(remove_button)

        save_button = QPushButton("Save to File", self)
        save_button.clicked.connect(self.save_to_file)
        layout.addWidget(save_button)

        add_button = QPushButton("Add Line", self)
        add_button.clicked.connect(self.add_line)
        layout.addWidget(add_button)

        # Dosyadan verileri okuyup ListView'e ekle
        with open("../veriler.txt", "r") as file:
            lines = file.readlines()
            for line in lines:
                self.list_widget.addItem(line.strip())  # Satır sonundaki boşlukları temizler

        self.list_widget.itemClicked.connect(self.on_item_clicked)

        central_widget.setLayout(layout)

    def on_item_clicked(self, item):
        selected_text = item.text()
        self.line_edit.setText(selected_text)

    def remove_selected_item(self):
        selected_item = self.list_widget.currentItem()
        if selected_item:
            self.list_widget.takeItem(self.list_widget.row(selected_item))
            self.line_edit.clear()

    def save_to_file(self):
        with open("../veriler.txt", "w") as file:
            for row in range(self.list_widget.count()):
                item = self.list_widget.item(row)
                text = item.text()
                file.write(text + "\n")

    def add_line(self):
        new_line = self.line_edit.text()
        if new_line:
            self.list_widget.addItem(new_line)
            self.line_edit.clear()

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = MyWindow()
    window.show()
    sys.exit(app.exec_())
