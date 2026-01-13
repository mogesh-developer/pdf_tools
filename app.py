
from flask import Flask, request, send_file, render_template, redirect, url_for, abort
import os, uuid, shutil
from utils.pdf_tools import merge_pdfs, split_pdf, compress_pdf, images_to_pdf, pdf_to_word, rotate_pdf, add_watermark, annotate_pdf, pdf_to_images, url_to_pdf, extract_text, add_password, remove_password, fill_form, redact_text, replace_text, add_highlight, add_text_stamp, edit_text_in_pdf, add_page_numbers, crop_pdf, reorder_pages, pdf_to_ppt, extract_pages
from utils.ppt_tools import create_ppt_with_image, add_text_to_ppt

app = Flask(__name__, static_folder="static", template_folder="templates")
UPLOAD_DIR = "uploads"
OUTPUT_DIR = "outputs"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

@app.route("/")
def home():
    return render_template("index.html")

@app.route('/merge', methods=['POST'])
def merge():
    files = request.files.getlist('files')
    paths = []
    for file in files:
        path = f"{UPLOAD_DIR}/{uuid.uuid4()}_{file.filename}"
        file.save(path)
        paths.append(path)
    output_filename = f"merged_{uuid.uuid4()}.pdf"
    output_path = f"{OUTPUT_DIR}/{output_filename}"
    merge_pdfs(paths, output_path)
    return send_file(output_path, as_attachment=True, download_name="merged.pdf")

@app.route('/split', methods=['POST'])
def split():
    file = request.files['file']
    input_path = f"{UPLOAD_DIR}/{uuid.uuid4()}_{file.filename}"
    file.save(input_path)
    split_folder = f"{OUTPUT_DIR}/{uuid.uuid4()}_split"
    os.makedirs(split_folder, exist_ok=True)
    split_pdf(input_path, split_folder)
    zip_path = f"{OUTPUT_DIR}/split_{uuid.uuid4()}"
    shutil.make_archive(zip_path, 'zip', split_folder)
    return send_file(f"{zip_path}.zip", as_attachment=True, download_name="split_pages.zip")

@app.route('/compress', methods=['POST'])
def compress():
    file = request.files['file']
    input_path = f"{UPLOAD_DIR}/{uuid.uuid4()}_{file.filename}"
    file.save(input_path)
    output_filename = f"compressed_{uuid.uuid4()}.pdf"
    output_path = f"{OUTPUT_DIR}/{output_filename}"
    compress_pdf(input_path, output_path)
    return send_file(output_path, as_attachment=True, download_name="compressed.pdf")

@app.route('/img-to-pdf', methods=['POST'])
def img_to_pdf():
    files = request.files.getlist('files')
    paths = []
    for file in files:
        path = f"{UPLOAD_DIR}/{uuid.uuid4()}_{file.filename}"
        file.save(path)
        paths.append(path)
    output_filename = f"images_{uuid.uuid4()}.pdf"
    output_path = f"{OUTPUT_DIR}/{output_filename}"
    images_to_pdf(paths, output_path)
    return send_file(output_path, as_attachment=True, download_name="images_converted.pdf")

@app.route('/pdf-to-word', methods=['POST'])
def pdf_to_docx():
    file = request.files['file']
    input_path = f"{UPLOAD_DIR}/{uuid.uuid4()}_{file.filename}"
    file.save(input_path)
    output_filename = f"converted_{uuid.uuid4()}.docx"
    output_path = f"{OUTPUT_DIR}/{output_filename}"
    pdf_to_word(input_path, output_path)
    return send_file(output_path, as_attachment=True, download_name="converted.docx")

@app.route('/rotate', methods=['POST'])
def rotate():
    file = request.files['file']
    rotation = int(request.form.get('rotation', 90))
    input_path = f"{UPLOAD_DIR}/{uuid.uuid4()}_{file.filename}"
    file.save(input_path)
    output_filename = f"rotated_{uuid.uuid4()}.pdf"
    output_path = f"{OUTPUT_DIR}/{output_filename}"
    rotate_pdf(input_path, output_path, rotation)
    return send_file(output_path, as_attachment=True, download_name="rotated.pdf")

@app.route('/watermark', methods=['POST'])
def watermark():
    file = request.files['file']
    text = request.form['text']
    input_path = f"{UPLOAD_DIR}/{uuid.uuid4()}_{file.filename}"
    file.save(input_path)
    output_filename = f"watermarked_{uuid.uuid4()}.pdf"
    output_path = f"{OUTPUT_DIR}/{output_filename}"
    add_watermark(input_path, output_path, text)
    return send_file(output_path, as_attachment=True, download_name="watermarked.pdf")

@app.route('/edit', methods=['POST'])
def edit_pdf_endpoint():
    file = request.files['file']
    edit_type = request.form['edit_type']
    text_content = request.form.get('text_content')
    x = float(request.form.get('x', 100))
    y = float(request.form.get('y', 100))
    x2 = float(request.form.get('x2', 200))
    y2 = float(request.form.get('y2', 200))
    color = request.form.get('color', '#000000')
    size = int(request.form.get('size', 20))
    page = int(request.form.get('page', 1))
    image = request.files.get('image')
    input_path = f"{UPLOAD_DIR}/{uuid.uuid4()}_{file.filename}"
    file.save(input_path)
    annotations = []
    if edit_type == "text" and text_content:
        annotations.append({
            "type": "text", "page": page, "x": x, "y": y,
            "content": text_content, "color": color, "size": size
        })
    elif edit_type == "rect":
        annotations.append({
            "type": "rect", "page": page, "x1": x, "y1": y, "x2": x2, "y2": y2,
            "color": color
        })
    elif edit_type == "image" and image:
        img_path = f"{UPLOAD_DIR}/{uuid.uuid4()}_{image.filename}"
        image.save(img_path)
        annotations.append({
            "type": "image", "page": page, "x1": x, "y1": y, "x2": x2, "y2": y2,
            "image_path": img_path
        })
    output_filename = f"edited_{uuid.uuid4()}.pdf"
    output_path = f"{OUTPUT_DIR}/{output_filename}"
    annotate_pdf(input_path, output_path, annotations)
    return send_file(output_path, as_attachment=True, download_name="edited.pdf")

@app.route('/pdf-to-jpg', methods=['POST'])
def pdf_to_jpg_endpoint():
    file = request.files['file']
    input_path = f"{UPLOAD_DIR}/{uuid.uuid4()}_{file.filename}"
    file.save(input_path)
    img_folder = f"{OUTPUT_DIR}/{uuid.uuid4()}_images"
    os.makedirs(img_folder, exist_ok=True)
    pdf_to_images(input_path, img_folder)
    zip_path = f"{OUTPUT_DIR}/images_{uuid.uuid4()}"
    shutil.make_archive(zip_path, 'zip', img_folder)
    return send_file(f"{zip_path}.zip", as_attachment=True, download_name="converted_images.zip")

@app.route('/html-to-pdf', methods=['POST'])
def html_to_pdf_endpoint():
    url = request.form['url']
    output_filename = f"webpage_{uuid.uuid4()}.pdf"
    output_path = f"{OUTPUT_DIR}/{output_filename}"
    success = url_to_pdf(url, output_path)
    if not success:
        return "Kaavalar Guardian Error: 'wkhtmltopdf' is missing. Please download it from https://wkhtmltopdf.org/downloads.html and add it to your System PATH to enable web-to-pdf features.", 500
    return send_file(output_path, as_attachment=True, download_name="webpage.pdf")

@app.route('/image-to-ppt', methods=['POST'])
def image_to_ppt_endpoint():
    files = request.files.getlist('files')
    paths = []
    for file in files:
        path = f"{UPLOAD_DIR}/{uuid.uuid4()}_{file.filename}"
        file.save(path)
        paths.append(path)
    output_filename = f"presentation_{uuid.uuid4()}.pptx"
    output_path = f"{OUTPUT_DIR}/{output_filename}"
    create_ppt_with_image(paths, output_path)
    return send_file(output_path, as_attachment=True, download_name="presentation.pptx")

@app.route('/edit-ppt', methods=['POST'])
def edit_ppt_endpoint():
    file = request.files['file']
    text = request.form['text']
    input_path = f"{UPLOAD_DIR}/{uuid.uuid4()}_{file.filename}"
    file.save(input_path)
    output_filename = f"edited_{uuid.uuid4()}.pptx"
    output_path = f"{OUTPUT_DIR}/{output_filename}"
    add_text_to_ppt(input_path, output_path, text)
    return send_file(output_path, as_attachment=True, download_name="edited_presentation.pptx")

@app.route('/extract-text', methods=['POST'])
def extract_text_endpoint():
    file = request.files['file']
    input_path = f"{UPLOAD_DIR}/{uuid.uuid4()}_{file.filename}"
    file.save(input_path)
    text = extract_text(input_path)
    output_filename = f"extracted_text_{uuid.uuid4()}.txt"
    output_path = f"{OUTPUT_DIR}/{output_filename}"
    with open(output_path, 'w') as f:
        f.write(text)
    return send_file(output_path, as_attachment=True, download_name="extracted_text.txt")

@app.route('/add-password', methods=['POST'])
def add_password_endpoint():
    file = request.files['file']
    password = request.form['password']
    input_path = f"{UPLOAD_DIR}/{uuid.uuid4()}_{file.filename}"
    file.save(input_path)
    output_filename = f"protected_{uuid.uuid4()}.pdf"
    output_path = f"{OUTPUT_DIR}/{output_filename}"
    add_password(input_path, output_path, password)
    return send_file(output_path, as_attachment=True, download_name="protected.pdf")

@app.route('/remove-password', methods=['POST'])
def remove_password_endpoint():
    file = request.files['file']
    password = request.form['password']
    input_path = f"{UPLOAD_DIR}/{uuid.uuid4()}_{file.filename}"
    file.save(input_path)
    output_filename = f"unprotected_{uuid.uuid4()}.pdf"
    output_path = f"{OUTPUT_DIR}/{output_filename}"
    remove_password(input_path, output_path, password)
    return send_file(output_path, as_attachment=True, download_name="unprotected.pdf")

@app.route('/fill-form', methods=['POST'])
def fill_form_endpoint():
    file = request.files['file']
    form_data = request.form.to_dict()
    # Remove 'file' key if present
    form_data.pop('file', None)
    input_path = f"{UPLOAD_DIR}/{uuid.uuid4()}_{file.filename}"
    file.save(input_path)
    output_filename = f"filled_{uuid.uuid4()}.pdf"
    output_path = f"{OUTPUT_DIR}/{output_filename}"
    fill_form(input_path, output_path, form_data)
    return send_file(output_path, as_attachment=True, download_name="filled_form.pdf")

@app.route('/redact-text', methods=['POST'])
def redact_text_endpoint():
    file = request.files['file']
    text_to_redact = request.form['text']
    input_path = f"{UPLOAD_DIR}/{uuid.uuid4()}_{file.filename}"
    file.save(input_path)
    output_filename = f"redacted_{uuid.uuid4()}.pdf"
    output_path = f"{OUTPUT_DIR}/{output_filename}"
    redact_text(input_path, output_path, text_to_redact)
    return send_file(output_path, as_attachment=True, download_name="redacted.pdf")

@app.route('/replace-text', methods=['POST'])
def replace_text_endpoint():
    file = request.files['file']
    old_text = request.form['old_text']
    new_text = request.form['new_text']
    input_path = f"{UPLOAD_DIR}/{uuid.uuid4()}_{file.filename}"
    file.save(input_path)
    output_filename = f"replaced_{uuid.uuid4()}.pdf"
    output_path = f"{OUTPUT_DIR}/{output_filename}"
    replace_text(input_path, output_path, old_text, new_text)
    return send_file(output_path, as_attachment=True, download_name="replaced.pdf")

@app.route('/add-highlight', methods=['POST'])
def add_highlight_endpoint():
    file = request.files['file']
    text_to_highlight = request.form['text']
    color = request.form.get('color', '#FFFF00')  # Default yellow
    # Convert hex to RGB tuple
    color = color.lstrip('#')
    color = tuple(int(color[i:i+2], 16)/255.0 for i in (0, 2, 4))
    input_path = f"{UPLOAD_DIR}/{uuid.uuid4()}_{file.filename}"
    file.save(input_path)
    output_filename = f"highlighted_{uuid.uuid4()}.pdf"
    output_path = f"{OUTPUT_DIR}/{output_filename}"
    add_highlight(input_path, output_path, text_to_highlight, color)
    return send_file(output_path, as_attachment=True, download_name="highlighted.pdf")

@app.route('/add-text-stamp', methods=['POST'])
def add_text_stamp_endpoint():
    file = request.files['file']
    text = request.form['text']
    position = request.form.get('position', 'center')
    font_size = int(request.form.get('font_size', 20))
    color_hex = request.form.get('color', '#000000')
    color = tuple(int(color_hex[i:i+2], 16)/255.0 for i in (1, 3, 5))
    page_num = request.form.get('page_num')
    page_num = int(page_num) if page_num else None
    input_path = f"{UPLOAD_DIR}/{uuid.uuid4()}_{file.filename}"
    file.save(input_path)
    output_filename = f"stamped_{uuid.uuid4()}.pdf"
    output_path = f"{OUTPUT_DIR}/{output_filename}"
    add_text_stamp(input_path, output_path, text, position, font_size, color, page_num)
    return send_file(output_path, as_attachment=True, download_name="stamped.pdf")

@app.route('/edit-text', methods=['POST'])
def edit_text_endpoint():
    file = request.files['file']
    # For simplicity, assume single change; in real app, could parse multiple
    page = int(request.form['page'])
    old_text = request.form['old_text']
    new_text = request.form['new_text']
    changes = [{'page': page, 'old_text': old_text, 'new_text': new_text}]
    input_path = f"{UPLOAD_DIR}/{uuid.uuid4()}_{file.filename}"
    file.save(input_path)
    output_filename = f"edited_text_{uuid.uuid4()}.pdf"
    output_path = f"{OUTPUT_DIR}/{output_filename}"
    edit_text_in_pdf(input_path, output_path, changes)
    return send_file(output_path, as_attachment=True, download_name="edited_text.pdf")

@app.route('/add-page-numbers', methods=['POST'])
def add_page_numbers_endpoint():
    file = request.files['file']
    start_page = int(request.form.get('start_page', 1))
    position = request.form.get('position', 'bottom-right')
    font_size = int(request.form.get('font_size', 12))
    color_hex = request.form.get('color', '#000000')
    color = tuple(int(color_hex[i:i+2], 16)/255.0 for i in (1, 3, 5))
    input_path = f"{UPLOAD_DIR}/{uuid.uuid4()}_{file.filename}"
    file.save(input_path)
    output_filename = f"numbered_{uuid.uuid4()}.pdf"
    output_path = f"{OUTPUT_DIR}/{output_filename}"
    add_page_numbers(input_path, output_path, start_page, position, font_size, color)
    return send_file(output_path, as_attachment=True, download_name="numbered.pdf")

@app.route('/crop-pdf', methods=['POST'])
def crop_pdf_endpoint():
    file = request.files['file']
    left = float(request.form.get('left', 0))
    top = float(request.form.get('top', 0))
    right = request.form.get('right')
    right = float(right) if right else None
    bottom = request.form.get('bottom')
    bottom = float(bottom) if bottom else None
    input_path = f"{UPLOAD_DIR}/{uuid.uuid4()}_{file.filename}"
    file.save(input_path)
    output_filename = f"cropped_{uuid.uuid4()}.pdf"
    output_path = f"{OUTPUT_DIR}/{output_filename}"
    crop_pdf(input_path, output_path, left, top, right, bottom)
    return send_file(output_path, as_attachment=True, download_name="cropped.pdf")

@app.route('/reorder-pages', methods=['POST'])
def reorder_pages_endpoint():
    file = request.files['file']
    page_order_str = request.form['page_order']
    page_order = [int(x.strip()) for x in page_order_str.split(',') if x.strip()]
    input_path = f"{UPLOAD_DIR}/{uuid.uuid4()}_{file.filename}"
    file.save(input_path)
    output_filename = f"reordered_{uuid.uuid4()}.pdf"
    output_path = f"{OUTPUT_DIR}/{output_filename}"
    reorder_pages(input_path, output_path, page_order)
    return send_file(output_path, as_attachment=True, download_name="reordered.pdf")

@app.route('/pdf-to-ppt', methods=['POST'])
def pdf_to_ppt_endpoint():
    file = request.files['file']
    input_path = f"{UPLOAD_DIR}/{uuid.uuid4()}_{file.filename}"
    file.save(input_path)
    output_filename = f"converted_{uuid.uuid4()}.pptx"
    output_path = f"{OUTPUT_DIR}/{output_filename}"
    pdf_to_ppt(input_path, output_path)
    return send_file(output_path, as_attachment=True, download_name="converted.pptx")

@app.route('/extract-pages', methods=['POST'])
def extract_pages_endpoint():
    file = request.files['file']
    pages = request.form['pages']
    input_path = f"{UPLOAD_DIR}/{uuid.uuid4()}_{file.filename}"
    file.save(input_path)
    output_filename = f"extracted_{uuid.uuid4()}.pdf"
    output_path = f"{OUTPUT_DIR}/{output_filename}"
    extract_pages(input_path, output_path, pages)
    return send_file(output_path, as_attachment=True, download_name="extracted.pdf")

if __name__ == "__main__":
    app.run(debug=True)
