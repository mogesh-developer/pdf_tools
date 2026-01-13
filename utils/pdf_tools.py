from PyPDF2 import PdfMerger, PdfReader, PdfWriter
from PIL import Image
from pdf2docx import Converter
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
import os, io
import fitz  # PyMuPDF
import pdfkit

def merge_pdfs(files, output):
    merger = PdfMerger()
    for file in files:
        merger.append(file)
    merger.write(output)
    merger.close()

def split_pdf(input_path, output_folder):
    reader = PdfReader(input_path)
    output_files = []
    for i, page in enumerate(reader.pages):
        writer = PdfWriter()
        writer.add_page(page)
        output_filename = f"split_page_{i+1}.pdf"
        output_path = os.path.join(output_folder, output_filename)
        with open(output_path, "wb") as f:
            writer.write(f)
        output_files.append(output_path)
    return output_files

def compress_pdf(input_path, output_path):
    reader = PdfReader(input_path)
    writer = PdfWriter()
    for page in reader.pages:
        page.compress_content_streams()
        writer.add_page(page)
    with open(output_path, "wb") as f:
        writer.write(f)

def images_to_pdf(image_paths, output_path):
    images = []
    for img_path in image_paths:
        img = Image.open(img_path)
        if img.mode != 'RGB':
            img = img.convert('RGB')
        images.append(img)
    
    if images:
        images[0].save(output_path, save_all=True, append_images=images[1:])

def pdf_to_word(pdf_path, docx_path):
    cv = Converter(pdf_path)
    cv.convert(docx_path, start=0, end=None)
    cv.close()

def rotate_pdf(input_path, output_path, rotation=90):
    reader = PdfReader(input_path)
    writer = PdfWriter()
    for page in reader.pages:
        page.rotate(rotation)
        writer.add_page(page)
    with open(output_path, "wb") as f:
        writer.write(f)

def add_watermark(input_path, output_path, watermark_text):
    # Create watermark PDF in memory
    packet = io.BytesIO()
    can = canvas.Canvas(packet, pagesize=letter)
    can.setFont("Helvetica", 40)
    can.setFillAlpha(0.3)
    can.saveState()
    can.translate(300, 400)
    can.rotate(45)
    can.drawCentredString(0, 0, watermark_text)
    can.restoreState()
    can.save()
    packet.seek(0)
    
    watermark_pdf = PdfReader(packet)
    watermark_page = watermark_pdf.pages[0]
    
    reader = PdfReader(input_path)
    writer = PdfWriter()
    
    for page in reader.pages:
        page.merge_page(watermark_page)
        writer.add_page(page)
        
    with open(output_path, "wb") as f:
        writer.write(f)

def annotate_pdf(input_path, output_path, annotations):
    """
    annotations: list of dicts with keys like type, x, y, content, color, size
    """
    doc = fitz.open(input_path)
    for ann in annotations:
        try:
            page_num = int(ann.get("page", 1)) - 1
            if page_num < 0 or page_num >= len(doc): continue
            page = doc[page_num]
            
            # Helper to convert hex to RGB 0-1
            def hex_to_rgb(h):
                h = h.lstrip('#')
                return tuple(int(h[i:i+2], 16)/255.0 for i in (0, 2, 4))

            color = hex_to_rgb(ann.get("color", "#000000"))
            
            if ann["type"] == "text":
                page.insert_text(
                    (float(ann["x"]), float(ann["y"])), 
                    ann["content"], 
                    fontsize=float(ann.get("size", 20)),
                    color=color
                )
            elif ann["type"] == "rect":
                page.draw_rect(
                    fitz.Rect(float(ann["x1"]), float(ann["y1"]), float(ann["x2"]), float(ann["y2"])),
                    color=color,
                    width=float(ann.get("width", 2))
                )
            elif ann["type"] == "image":
                rect = fitz.Rect(float(ann["x1"]), float(ann["y1"]), float(ann["x2"]), float(ann["y2"]))
                page.insert_image(rect, filename=ann["image_path"])
        except Exception as e:
            print(f"Error annotating: {e}")
            continue
            
    doc.save(output_path)
    doc.close()

def pdf_to_images(input_path, output_folder):
    doc = fitz.open(input_path)
    image_paths = []
    for i in range(len(doc)):
        page = doc[i]
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x zoom for better quality
        output_path = os.path.join(output_folder, f"page_{i+1}.jpg")
        pix.save(output_path)
        image_paths.append(output_path)
    doc.close()
    return image_paths

def url_to_pdf(url, output_path):
    # This requires wkhtmltopdf installed on your system
    # Check common paths on Windows if it's not in PATH
    path_to_wkhtmltopdf = r'C:\Program Files\wkhtmltopdf\bin\wkhtmltopdf.exe'
    config = None
    if os.path.exists(path_to_wkhtmltopdf):
        config = pdfkit.configuration(wkhtmltopdf=path_to_wkhtmltopdf)
        
    try:
        pdfkit.from_url(url, output_path, configuration=config)
        return True
    except Exception as e:
        print(f"pdfkit error diagnostic: {e}")
        # If still failing, return False to trigger the informative HTTPException in app.py
        return False

def extract_text(input_path):
    reader = PdfReader(input_path)
    text = ""
    for page in reader.pages:
        text += page.extract_text() + "\n"
    return text

def add_password(input_path, output_path, password):
    reader = PdfReader(input_path)
    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)
    writer.encrypt(password)
    with open(output_path, "wb") as f:
        writer.write(f)

def remove_password(input_path, output_path, password):
    reader = PdfReader(input_path)
    if reader.is_encrypted:
        reader.decrypt(password)
    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)
    with open(output_path, "wb") as f:
        writer.write(f)

def fill_form(input_path, output_path, form_data):
    """
    form_data: dict of field_name: value
    """
    doc = fitz.open(input_path)
    for page in doc:
        for field in page.widgets():
            if field.field_name in form_data:
                field.field_value = form_data[field.field_name]
                field.update()
    doc.save(output_path)
    doc.close()

def redact_text(input_path, output_path, text_to_redact):
    doc = fitz.open(input_path)
    for page in doc:
        text_instances = page.search_for(text_to_redact)
        for inst in text_instances:
            page.add_redact_annot(inst)
        page.apply_redactions()
    doc.save(output_path)
    doc.close()

def replace_text(input_path, output_path, old_text, new_text):
    doc = fitz.open(input_path)
    for page in doc:
        text_instances = page.search_for(old_text)
        for inst in text_instances:
            page.add_redact_annot(inst)
        page.apply_redactions()
        # After redaction, insert new text at the position
        # This is approximate, as position might not be exact
        for inst in text_instances:
            page.insert_text(inst.top_left, new_text, fontsize=12)
    doc.save(output_path)
    doc.close()

def add_highlight(input_path, output_path, text_to_highlight, color=(1, 1, 0)):
    doc = fitz.open(input_path)
    for page in doc:
        text_instances = page.search_for(text_to_highlight)
        for inst in text_instances:
            highlight = page.add_highlight_annot(inst)
            highlight.set_colors(stroke=color)
            highlight.update()
    doc.save(output_path)
    doc.close()

def add_text_stamp(input_path, output_path, text, position='center', font_size=20, color=(0,0,0), page_num=None):
    """
    Add text stamp to PDF pages
    position: 'center', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right'
    page_num: None for all pages, or specific page number (1-based)
    """
    doc = fitz.open(input_path)
    pages = [doc[page_num - 1]] if page_num else doc
    for page in pages:
        page_width = page.rect.width
        page_height = page.rect.height
        
        if position == 'center':
            x = page_width / 2
            y = page_height / 2
        elif position == 'top':
            x = page_width / 2
            y = 50
        elif position == 'bottom':
            x = page_width / 2
            y = page_height - 50
        elif position == 'top-left':
            x = 50
            y = 50
        elif position == 'top-right':
            x = page_width - 50
            y = 50
        elif position == 'bottom-left':
            x = 50
            y = page_height - 50
        elif position == 'bottom-right':
            x = page_width - 50
            y = page_height - 50
        else:
            x = page_width / 2
            y = page_height / 2
        
        page.insert_text((x, y), text, fontsize=font_size, color=color, align=fitz.TEXT_ALIGN_CENTER)
    doc.save(output_path)
    doc.close()

def edit_text_in_pdf(input_path, output_path, changes):
    """
    changes: list of dicts {'page': int, 'old_text': str, 'new_text': str}
    """
    doc = fitz.open(input_path)
    for change in changes:
        page_num = change['page'] - 1
        if page_num < 0 or page_num >= len(doc):
            continue
        page = doc[page_num]
        old_text = change['old_text']
        new_text = change['new_text']
        text_instances = page.search_for(old_text)
        for inst in text_instances:
            page.add_redact_annot(inst)
        page.apply_redactions()
        # Insert new text at approximate position
        if text_instances:
            pos = text_instances[0].top_left
            page.insert_text(pos, new_text, fontsize=12)
    doc.save(output_path)
    doc.close()

def add_page_numbers(input_path, output_path, start_page=1, position='bottom-right', font_size=12, color=(0,0,0)):
    """
    Add page numbers to PDF
    position: 'bottom-left', 'bottom-center', 'bottom-right', 'top-left', 'top-center', 'top-right'
    """
    doc = fitz.open(input_path)
    for i, page in enumerate(doc):
        page_num = start_page + i
        page_width = page.rect.width
        page_height = page.rect.height
        
        if position == 'bottom-left':
            x = 50
            y = page_height - 30
        elif position == 'bottom-center':
            x = page_width / 2
            y = page_height - 30
        elif position == 'bottom-right':
            x = page_width - 50
            y = page_height - 30
        elif position == 'top-left':
            x = 50
            y = 30
        elif position == 'top-center':
            x = page_width / 2
            y = 30
        elif position == 'top-right':
            x = page_width - 50
            y = 30
        else:
            x = page_width - 50
            y = page_height - 30
        
        page.insert_text((x, y), str(page_num), fontsize=font_size, color=color, align=fitz.TEXT_ALIGN_CENTER)
    doc.save(output_path)
    doc.close()

def crop_pdf(input_path, output_path, left=0, top=0, right=None, bottom=None):
    """
    Crop PDF pages
    left, top, right, bottom: coordinates in points (1/72 inch)
    If right/bottom None, use page dimensions
    """
    doc = fitz.open(input_path)
    for page in doc:
        page_width = page.rect.width
        page_height = page.rect.height
        right = right or page_width
        bottom = bottom or page_height
        page.set_cropbox(fitz.Rect(left, top, right, bottom))
    doc.save(output_path)
    doc.close()

def reorder_pages(input_path, output_path, page_order):
    """
    Reorder PDF pages
    page_order: list of 1-based page numbers, e.g. [3,1,2]
    """
    reader = PdfReader(input_path)
    writer = PdfWriter()
    for page_num in page_order:
        if 1 <= page_num <= len(reader.pages):
            writer.add_page(reader.pages[page_num - 1])
    with open(output_path, "wb") as f:
        writer.write(f)

def pdf_to_ppt(input_path, output_path):
    """
    Convert PDF to PPT by extracting images from each page
    """
    from pptx import Presentation
    from pptx.util import Inches
    
    doc = fitz.open(input_path)
    prs = Presentation()
    
    for i, page in enumerate(doc):
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
        img_path = f"{os.path.dirname(output_path)}/temp_page_{i}.png"
        pix.save(img_path)
        
        slide = prs.slides.add_slide(prs.slide_layouts[6])  # blank slide
        left = top = Inches(0)
        slide.shapes.add_picture(img_path, left, top, width=Inches(10), height=Inches(7.5))
        
        os.remove(img_path)  # cleanup
    
    prs.save(output_path)
    doc.close()

def extract_pages(input_path, output_path, pages):
    """
    Extract specific pages from PDF
    pages: list of 1-based page numbers or ranges like "1-3,5"
    """
    reader = PdfReader(input_path)
    writer = PdfWriter()
    
    page_set = set()
    for part in pages.replace(' ', '').split(','):
        if '-' in part:
            start, end = map(int, part.split('-'))
            page_set.update(range(start, end + 1))
        else:
            page_set.add(int(part))
    
    for page_num in sorted(page_set):
        if 1 <= page_num <= len(reader.pages):
            writer.add_page(reader.pages[page_num - 1])
    
    with open(output_path, "wb") as f:
        writer.write(f)
