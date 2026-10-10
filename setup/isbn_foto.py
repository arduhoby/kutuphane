import requests

def get_book_cover_url(isbn):
    base_url = "http://openlibrary.org/api/books"
    response = requests.get(f"{base_url}?bibkeys=ISBN:{isbn}&format=json&jscmd=data")

    if response.status_code == 200:
        data = response.json()
        if f"ISBN:{isbn}" in data:
            book_info = data[f"ISBN:{isbn}"]
            if "cover" in book_info:
                cover_url = book_info["cover"]["medium"]
                return cover_url
            else:
                return "url hatası"
        else:
            return "bos"
    else:
        return "bos"

# ISBN numarasını belirtin
# isbn_number = "978605332094"
# cover_url = get_book_cover_url(isbn_number)
# print(type(cover_url))
# print(get_book_cover_url(isbn_number))

