from pypdf import PdfReader, PdfWriter
import json
import webbrowser

reader = PdfReader("../claims_db/VBA-21-526EZ-ARE.pdf")
writer = PdfWriter()
writer.clone_reader_document_root(reader)

#open json file as a dict in python -- this json is returned from the llm
with open('../claims_db/vet-info.json') as json_file:
    data = json.load(json_file)

fields = reader.get_form_text_fields()

#write fields to a JSON file:
with open("../claims_db/prompts.json", "w") as outfile: 
    json.dump(fields, outfile)

for page in reader.pages:
    #print(page.page_number)
    for field in fields:
        #print(field)
        if field in data:
            writer.update_page_form_field_values(writer.pages[page.page_number], {field: data[field]}, auto_regenerate=False,)

with open("../claims_db/filled-out.pdf", "wb") as output_stream:
    writer.write(output_stream)

#open webbrowser in pop up
webbrowser.open_new(r'file:///Users/gracejin/GitHub/vets-claim/claims_db/filled-out.pdf')