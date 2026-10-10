import requests

def get_book_info(isbn):
    # Try fetching book info from Google Books API
    google_info = get_book_info_from_google(isbn)
    if google_info:

        return google_info

    # If Google Books API fails, try Open Library API
    openlibrary_info = get_book_info_from_openlibrary(isbn)
    if openlibrary_info:
        return openlibrary_info

    # If both APIs fail, return an error message or handle as needed
    return "Book information not found"

def get_book_info_from_google(isbn):
    api_url = f'https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}'
    response = requests.get(api_url)
    data = response.json()

    if "items" in data and len(data["items"]) > 0:
        book_info = data["items"][0]["volumeInfo"]
        # Process book_info and return relevant details
        return {
            'title': book_info.get("title", "Unknown Title"),
            'authors': data["items"][0]["volumeInfo"].get("authors", []),
            'publisher': data["items"][0]["volumeInfo"].get("publisher", "Bilinmiyor"),
            'publication_date': data["items"][0]["volumeInfo"].get("publishedDate", "Bilinmiyor"),
            'page_count': data["items"][0]["volumeInfo"].get("pageCount", []),
            'language': data["items"][0]["volumeInfo"].get("language", "Bilinmiyor"),
            'description': data["items"][0]["volumeInfo"].get("description", ""),
            'smallThumbnail': data["items"][0]["volumeInfo"].get("imageLinks", {}).get("smallThumbnail", "Resim Yok"),
            'isbn': isbn
        }
    return None  # Return None if data is not available

def get_book_info_from_openlibrary(isbn):
    base_url = "http://openlibrary.org/api/books"
    response = requests.get(f"{base_url}?bibkeys=ISBN:{isbn}&format=json&jscmd=data")

    if response.status_code == 200:
        data = response.json()
        if f"ISBN:{isbn}" in data:
            book_info = data[f"ISBN:{isbn}"]
            if "cover" in book_info:
                cover_url = book_info["cover"]["medium"]
                return {
                    'cover_url': cover_url,
                    # ... other fields ...
                }
            else:
                return None
    return None

# # Usage
isbn = "9786058352735"
# # book_info = get_book_info(isbn)
# # print(book_info)
print(get_book_info(isbn))
# print()
# print(get_book_info_from_google(isbn))
# print(get_book_info_from_openlibrary(isbn))