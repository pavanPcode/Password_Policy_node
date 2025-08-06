const express = require('express');
const multer = require('multer');
const ExcelJS = require('exceljs');
const axios = require('axios');
const router = express.Router();
const fs = require('fs');
const { handleRecordWithOutRes } = require('./server'); // Adjust path as needed
const { OperationEnums } = require("./utilityEnum.js");

// Multer setup to handle file upload
const storage = multer.memoryStorage();
// const upload = multer({ storage: storage });
const upload = multer({ dest: 'uploads/' });

router.post('/upload-ahu-excel', upload.single('file'), async (req, res) => {
  try {
    // ✅ Read from form-data
    const CreatedBy = 
  req.user?.UserID ||
  req.body.userId ||
  req.body.UserID || // <-- this line handles Postman form-data "UserID"
  req.headers['userid'];


    if (!CreatedBy) {
      return res.status(401).json({ error: 'UserID missing in request', status: false });
    }
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded',status:false });

    // 1. Get location mappings
    const locRes = await axios.get('http://localhost:8080/api/getlocations');
    const locationData = Array.isArray(locRes.data?.ResultData) ? locRes.data.ResultData : [];

    const locationMap = {};
    locationData.forEach(loc => {
      if (loc.BlockName && loc.BlockId) {
        locationMap[loc.BlockName.trim()] = loc.BlockId;
      }
    });

    // 2. Read Excel
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(file.path);
    const sheet = workbook.getWorksheet('AHU Sample');
    if (!sheet) {
      return res.status(400).json({ error: 'Sheet "AHU Sample" not found',status:false });
    }

    const insertedRows = [];
    let totalInserted = 0;

    // 3. Loop through rows
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const values = row.values.slice(1); // Remove undefined at index 0

      if (values.length < 9) continue;

      const [
        Code,
        Description,
        LocationName,
        Department,
        Manufacturer,
        ModelNo,
        Capacity,
        Sparescount,
        Remarks
      ] = values;

      const Location = locationMap[LocationName?.trim()];
      if (!Location) {
        console.log(`Skipping row ${rowNumber}: Unknown Location "${LocationName}"`);
        continue;
      }

      const NewValues = {
        Code,
        Description,
        Location,
        Department,
        Manufacturer,
        ModelNo,
        Capacity,
        Sparescount,
        Remarks,
        CreatedBy: CreatedBy
      };

      const payload = {
        ScreenName: "AddAHU",
        ApiName: "AddAHU",
        NewValues,
        UpdateValues: "Capacity",
        ScreenValues: "Capacity",
        CreatedBy: 1
      };

      const data = {
        ...payload,
        ScreenOperationId: OperationEnums().AddAHUEnum,
        Approvaltype: 1,
        OldValues: {}
      };

      const result = await handleRecordWithOutRes( data, OperationEnums().addApprovalSetting);
      if (result?.success || result?.status === 200) {
        totalInserted++;
        insertedRows.push(payload);
      } else {
        console.warn(`Failed to insert row ${rowNumber}`);
      }
    }

    // Cleanup uploaded file
    fs.unlinkSync(file.path);

    res.status(200).json({
      message: `File processed. ${totalInserted} row(s) inserted.`,
      total: totalInserted,
      data: insertedRows,status:true
    });

  } catch (err) {
    console.error('Excel upload error:', err);
    res.status(500).json({ error: 'Failed to process Excel file',status:false });
  }
});




// router.post('/upload-ahu-excel', upload.single('file'), async (req, res) => {
//   try {
//     const file = req.file;
//     if (!file) return res.status(400).json({ error: 'No file uploaded' });

//     // Step 1: Fetch location data from API
//     const locRes = await axios.get('http://localhost:8080/api/getlocations');

//     // Fix: Make sure locRes.data is an array
//     const locationData = Array.isArray(locRes.data.ResultData)
//       ? locRes.data.ResultData
//       : [];

//     const locationMap = {};
//     locationData.forEach(loc => {
//       if (loc.BlockName && loc.BlockId) {
//         locationMap[loc.BlockName.trim()] = loc.BlockId;
//       }
//     });

//     // Step 2: Read Excel file
//     const workbook = new ExcelJS.Workbook();
//     await workbook.xlsx.readFile(file.path);

//     const sheet = workbook.getWorksheet('AHU Sample');
//     if (!sheet) {
//       return res.status(400).json({ error: 'Sheet "AHU Sample" not found' });
//     }

//     const insertedRows = [];

//     sheet.eachRow((row, rowNumber) => {
//       if (rowNumber === 1) return; // Skip header

//       const values = row.values.slice(1); // Remove first undefined value

//       if (values.length < 9) return;

//       const [
//         Code,
//         Description,
//         LocationName,
//         Department,
//         Manufacturer,
//         ModelNo,
//         Capacity,
//         Sparescount,
//         Remarks
//       ] = values;

//       const Location = locationMap[LocationName?.trim()];
//       if (!Location) {
//         console.log(`Skipping row ${rowNumber}: Unknown Location "${LocationName}"`);
//         return;
//       }

//       insertedRows.push({
//         ScreenName: "AddAHU",
//         ApiName: "AddAHU",
//         NewValues: {
//           Code,
//           Description,
//           Location,
//           Department,
//           Manufacturer,
//           ModelNo,
//           Capacity,
//           Sparescount,
//           Remarks,
//           CreatedBy: 4
//         },
//         UpdateValues: "Capacity",
//         ScreenValues: "Capacity",
//         CreatedBy: 1
//       });
//     });

//     // Optional: Clean up uploaded file
//     fs.unlinkSync(file.path);

//     // Optional: Send data to AddAHU API (uncomment to enable)
//     // for (const data of insertedRows) {
//     //   await axios.post('http://localhost:3000/api/AddAHU', data);
//     // }

//     res.status(200).json({
//       message: 'File parsed successfully',
//       total: insertedRows.length,
//       data: insertedRows
//     });

//   } catch (err) {
//     console.error('Error parsing AHU Excel:', err.message);
//     res.status(500).json({ error: 'Failed to process Excel file' });
//   }
// });




// API to download sample Excel file


router.get('/sample-ahu-excel', async (req, res) => {
  try {
    const apiUrl = 'http://localhost:8080/api/getlocations'; // Use .env in production

    const { data } = await axios.get(apiUrl);
    const locationNames = data.ResultData.map(loc => loc.BlockName);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('AHU Sample');

    sheet.columns = [
      { header: 'Code', key: 'Code' },
      { header: 'Description', key: 'Description' },
      { header: 'Location', key: 'Location' },
      { header: 'Department', key: 'Department' },
      { header: 'Manufacturer', key: 'Manufacturer' },
      { header: 'ModelNo', key: 'ModelNo' },
      { header: 'Capacity', key: 'Capacity' },
      { header: 'Sparescount', key: 'Sparescount' },
      { header: 'Remarks', key: 'Remarks' },
    ];

    for (let i = 2; i <= 100; i++) {
      sheet.getCell(`C${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${locationNames.join(',')}"`],
        showErrorMessage: true,
        error: 'Please select a valid location from dropdown.'
      };
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=ahu_sample.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error generating Excel:', err.message);
    res.status(500).json({ error: 'Failed to generate sample Excel file' });
  }
});


module.exports = router;
