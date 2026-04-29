const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('../my_doc/UI_prototypes/project/uploads/Uniform_Online_Order_Form.pdf');

pdf(dataBuffer).then(function(data) {
    console.log(data.text);
}).catch(console.error);
