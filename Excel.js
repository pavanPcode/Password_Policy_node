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
const path = require('path');

// router.post('/upload-ahu-excel', upload.single('file'), async (req, res) => {
//   try {
//     // ✅ Read from form-data
//     const CreatedBy = 
//   req.user?.UserID ||
//   req.body.userId ||
//   req.body.UserID || // <-- this line handles Postman form-data "UserID"
//   req.headers['userid'];


//     if (!CreatedBy) {
//       return res.status(401).json({ error: 'UserID missing in request', status: false });
//     }
//     const file = req.file;
//     if (!file) return res.status(400).json({ error: 'No file uploaded',status:false });

//     // 1. Get location mappings
//     // const locRes = await axios.get('http://localhost:8080/api/getlocations');
//     // const locationData = Array.isArray(locRes.data?.ResultData) ? locRes.data.ResultData : [];
//     const locRes = await handleRecordWithOutRes( {}, OperationEnums().getlocations)
//     console.log('locRes',locRes)
//     const locationData = Array.isArray(locRes?.data?.ResultData) ? locRes.data.ResultData : [];




//     const locationMap = {};
//     locationData.forEach(loc => {
//       if (loc.BlockName && loc.BlockId) {
//         locationMap[loc.BlockName.trim()] = loc.BlockId;
//       }
//     });

//     // 2. Read Excel
//     const workbook = new ExcelJS.Workbook();
//     await workbook.xlsx.readFile(file.path);
//     const sheet = workbook.getWorksheet('AHU Sample');
//     if (!sheet) {
//       return res.status(400).json({ error: 'Sheet "AHU Sample" not found',status:false });
//     }

//     const insertedRows = [];
//     let totalInserted = 0;

//     // 3. Loop through rows
//     for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
//       const row = sheet.getRow(rowNumber);
//       const values = row.values.slice(1); // Remove undefined at index 0

//       if (values.length < 9) continue;

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
//         continue;
//       }

//       const NewValues = {
//         Code,
//         Description,
//         Location,
//         Department,
//         Manufacturer,
//         ModelNo,
//         Capacity,
//         Sparescount,
//         Remarks,
//         CreatedBy: CreatedBy
//       };

//       const payload = {
//         ScreenName: "AddAHU",
//         ApiName: "AddAHU",
//         NewValues,
//         UpdateValues: "Capacity",
//         ScreenValues: "Capacity",
//         CreatedBy: 1
//       };

//       const data = {
//         ...payload,
//         ScreenOperationId: OperationEnums().AddAHUEnum,
//         Approvaltype: 1,
//         OldValues: {}
//       };

//       const result = await handleRecordWithOutRes( data, OperationEnums().addApprovalSetting);
//       if (result?.success || result?.status === 200) {
//         totalInserted++;
//         insertedRows.push(payload);
//       } else {
//         console.warn(`Failed to insert row ${rowNumber}`);
//       }
//     }

//     // Cleanup uploaded file
//     fs.unlinkSync(file.path);

//     res.status(200).json({
//       message: `File processed. ${totalInserted} row(s) inserted.`,
//       total: totalInserted,
//       data: insertedRows,status:true
//     });

//   } catch (err) {
//     console.error('Excel upload error:', err);
//     res.status(500).json({ error: 'Failed to process Excel file',status:false });
//   }
// });



router.post('/upload-ahu-excel', upload.single('file'), async (req, res) => {
  try {
    // ✅ Get CreatedBy from multiple sources
    const CreatedBy =
      req.user?.UserID ||
      req.body.userId ||
      req.body.UserID ||
      req.headers['userid'];

    if (!CreatedBy) {
      return res.status(401).json({ error: 'UserID missing in request', status: false });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded', status: false });
    }

    // ✅ Get location data from DB
    const locRes = await handleRecordWithOutRes({}, OperationEnums().getlocations);
    const locationData = Array.isArray(locRes?.ResultData) ? locRes.ResultData : [];

    // ✅ Build normalized location map (case-insensitive)
    const locationMap = {};
    locationData.forEach(loc => {
      if (loc.BlockName && loc.BlockId) {
        locationMap[loc.BlockName.trim().toLowerCase()] = loc.BlockId;
      }
    });

    // ✅ Read Excel
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(file.path);
    const sheet = workbook.getWorksheet('AHU Sample');

    if (!sheet) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ error: 'Sheet "AHU Sample" not found', status: false });
    }

    const insertedRows = [];
    let totalInserted = 0;

    // ✅ Loop rows starting from row 2
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const values = row.values.slice(1); // Skip index 0

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

      const normalizedLocation = LocationName?.trim().toLowerCase();
      const Location = locationMap[normalizedLocation];

      if (!Location) {
        console.warn(`Skipping row ${rowNumber}: Unknown Location "${LocationName}"`);
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
        CreatedBy
      };

      const payload = {
        ScreenName: "AddAHU",
        ApiName: "AddAHU",
        NewValues,
        UpdateValues: "Capacity",
        ScreenValues: "Capacity",
        CreatedBy
      };

      const data = {
        ...payload,
        ScreenOperationId: OperationEnums().AddAHUEnum,
        Approvaltype: 1,
        OldValues: {}
      };

      const result = await handleRecordWithOutRes(data, OperationEnums().addApprovalSetting);

      if (result?.Status === true) {
        totalInserted++;
        insertedRows.push(NewValues);
      } else {
        console.warn(`❌ Failed to insert row ${rowNumber}:`, result?.error || 'Unknown error');
      }
    }

    // ✅ Delete uploaded temp file
    fs.unlinkSync(file.path);

    return res.status(200).json({
      message: `File processed. ${totalInserted} row(s) inserted.`,
      total: totalInserted,
      insertedRows,
      status: true
    });

  } catch (err) {
    console.error('❌ Excel upload error:', err);
    return res.status(500).json({ error: 'Failed to process Excel file', status: false });
  }
});




// API to download sample Excel file


router.get('/sample-ahu-excel', async (req, res) => {
  try {
    // const apiUrl = 'http://localhost:8080/api/getlocations'; // Use .env in production

    // const { data } = await axios.get(apiUrl);
    // const locationNames = data.ResultData.map(loc => loc.BlockName);

    // 🔄 Fetch location data using SP-based method only
    const locRes = await handleRecordWithOutRes({}, OperationEnums().getlocations);

    if (!locRes || !locRes.Status) {
      console.error('Failed to fetch locations:', locRes?.error || 'Unknown error');
      return res.status(500).json({ error: 'Failed to fetch locations' });
    }
    const locationNames = locRes.ResultData.map(loc => loc.BlockName);


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


router.get('/sample-filter-excel', async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('AHU Filter Sample');

    sheet.columns = [
      { header: 'AHUId (Select AHU Code)', key: 'AHUId' }, // A
      { header: 'Lable', key: 'Lable' },                   // B
      { header: 'AssetType (Filter Type)', key: 'AssetType' }, // C
      { header: 'Manufacturer', key: 'Manufacturer' },     // D
      { header: 'InstalledOn (YYYY-MM-DD)', key: 'InstalledOn' }, // E
      { header: 'Location', key: 'Location' },             // F
      { header: 'Dimensions', key: 'Dimensions' },         // G
      { header: 'MicronRating', key: 'MicronRating' },     // H
      { header: 'CleaningLimit', key: 'CleaningLimit' },   // I
      { header: 'LastCleaningDate (YYYY-MM-DD)', key: 'LastCleaningDate' }, // J
      { header: 'ValidOperationLife (in days)', key: 'ValidOperationLife' }, // K
      { header: 'CurrentStatus', key: 'CurrentStatus' },   // L
      { header: 'AvailabilityStatus', key: 'AvailabilityStatus' }, // M
      { header: 'Specifications', key: 'Specifications' }, // N
      { header: 'cleaningFreqAllowance', key: 'cleaningFreqAllowance' }, // O
      { header: 'ROmax', key: 'ROmax' },                   // P
      { header: 'ROmin', key: 'ROmin' },                   // Q
      { header: 'AirMax', key: 'AirMax' },                 // R
      { header: 'AirMin', key: 'AirMin' },                 // S
      { header: 'cleaningdays', key: 'cleaningdays' }      // T
    ];

    // 🔄 Fetch locations
    const locationRes = await handleRecordWithOutRes({}, OperationEnums().getlocations);
    const locationNames = locationRes?.Status
      ? locationRes.ResultData.map(loc => loc.BlockName?.trim()).filter(Boolean)
      : [];

    // 🔄 Fetch AHU list
    const ahuRes = await handleRecordWithOutRes({}, OperationEnums().getAHUId);
    const ahuCodes = ahuRes?.Status
      ? ahuRes.ResultData.map(item => item.code?.trim()).filter(Boolean)
      : [];

    // 🔄 Fetch filter types
    const filterTypeRes = await handleRecordWithOutRes({}, OperationEnums().GETFILTERTYPES);
    const filterTypes = filterTypeRes?.Status
      ? filterTypeRes.ResultData.map(ft => ft.AssetType?.trim()).filter(Boolean)
      : [];

    const availabilityStatusOptions = ['In Use', 'Spare'];
    const currentStatusOptions = ['Active', 'Cleaning', 'Storage'];

    for (let i = 2; i <= 100; i++) {
      // A → AHU Unique ID
      sheet.getCell(`A${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${ahuCodes.join(',')}"`],
        showErrorMessage: true,
        error: 'Please select a valid AHU Code.'
      };

      // C → Filter Type
      sheet.getCell(`C${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${filterTypes.join(',')}"`],
        showErrorMessage: true,
        error: 'Please select a valid Filter Type.'
      };

      // F → Location
      sheet.getCell(`F${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${locationNames.join(',')}"`],
        showErrorMessage: true,
        error: 'Please select a valid Location.'
      };

      // L → Current Status
      sheet.getCell(`L${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${currentStatusOptions.join(',')}"`],
        showErrorMessage: true,
        error: 'Please select a valid Current Status.'
      };

      // M → Availability Status
      sheet.getCell(`M${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${availabilityStatusOptions.join(',')}"`],
        showErrorMessage: true,
        error: 'Please select a valid Availability Status.'
      };
    }

    // 📤 Send Excel file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=ahu_filter_sample.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('❌ Error generating sample filter Excel:', err);
    res.status(500).json({ error: 'Failed to generate sample file', status: false });
  }
});


// 🔄 Helper to pad barcode
const pad = (n) => n.toString().padStart(2, '0');

// 🔄 Map display names to IDs
async function fetchReferenceData() {
  const [ahuRes, locationRes, filterTypeRes] = await Promise.all([
    handleRecordWithOutRes({}, OperationEnums().getAHUId),
    handleRecordWithOutRes({}, OperationEnums().getlocations),
    handleRecordWithOutRes({}, OperationEnums().GETFILTERTYPES)
  ]);

  const ahuMap = {};
  if (ahuRes?.Status) {
    ahuRes.ResultData.forEach(item => {
      if (item.code) ahuMap[item.code.trim()] = item.id;
    });
  }

  const locationMap = {};
  if (locationRes?.Status) {
    locationRes.ResultData.forEach(item => {
      if (item.BlockName) locationMap[item.BlockName.trim()] = item.BlockId;
    });
  }

  const filterTypeMap = {};
  if (filterTypeRes?.Status) {
    filterTypeRes.ResultData.forEach(item => {
      if (item.AssetType) filterTypeMap[item.AssetType.trim()] = item.Id;
    });
  }

  return { ahuMap, locationMap, filterTypeMap };
}

router.post('/upload-filter-excel', upload.single('file'), async (req, res) => {
  try {

    // ✅ Get CreatedBy from multiple sources
    const CreatedBy =
      req.user?.UserID ||
      req.body.userId ||
      req.body.UserID ||
      req.headers['userid'];

    if (!CreatedBy) {
      return res.status(401).json({ error: 'UserID missing in request', status: false });
    }
    const workbook = new ExcelJS.Workbook();
    const filePath = path.resolve(req.file.path);
    await workbook.xlsx.readFile(filePath);
    fs.unlinkSync(filePath); // remove after read

    const sheet = workbook.worksheets[0];
    const rows = sheet.getRows(2, sheet.rowCount - 1);

    const { ahuMap, locationMap, filterTypeMap } = await fetchReferenceData();
    console.log( 'fetchReferenceData',ahuMap, locationMap, filterTypeMap );

    const failed = [];
    const success = [];

    for (const row of rows) {
      const values = row.values;

      const AHUCode = values[1]?.toString().trim();
      const FilterType = values[3]?.toString().trim();
      const LocationName = values[6]?.toString().trim();

      const NewValues = {
        AHUId: ahuMap[AHUCode] || null,
        Lable: values[2]?.toString().trim(),
        AssetType: filterTypeMap[FilterType] || null,
        Manufacturer: values[4],
        InstalledOn: values[5],
        Location: locationMap[LocationName] || null,
        Dimensions: values[7],
        MicronRating: values[8],
        CleaningLimit: values[9],
        LastCleaningDate: values[10],
        ValidOperationLife: parseInt(values[11]),
        CurrentStatus: values[12],
        AvailabilityStatus: values[13],
        Specifications: values[14],
        CreatedBy: CreatedBy,
        cleaningFreqAllowance: parseInt(values[15]),
        ROmax: parseFloat(values[16]),
        ROmin: parseFloat(values[17]),
        AirMax: parseFloat(values[18]),
        AirMin: parseFloat(values[19]),
        cleaningdays: parseInt(values[20])
      };

      // Skip if required mappings are missing
      if (!NewValues.AHUId || !NewValues.AssetType || !NewValues.Location) {
        failed.push({ row: row.number, reason: 'Mapping failed', AHUCode, FilterType, LocationName });
        continue;
      }

      // Barcode generation
      const now = new Date();
      const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const barcode = timestamp.slice(-8);

      NewValues.FilterId = `FLT${barcode.slice(-4)}`;
      NewValues.Barcode = barcode;

      const jsondata = {
        ScreenName: "AddAHUFilter",
        ApiName: "AddAHUFilter",
        NewValues,
        UpdateValues: "Manufacturer",
        ScreenValues: "Manufacturer",
        CreatedBy: 1
      };

      const totaldata = {
        jsondata,
        ScreenOperationId: OperationEnums().AddAHUFilter,
        Approvaltype: 1,
        OldValues: {}
      };

      const response = await handleRecordWithOutRes(totaldata, OperationEnums().addApprovalSetting);

      if (response?.Status) {
        success.push({ row: row.number, FilterId: NewValues.FilterId,status:true });
      } else {
        failed.push({ row: row.number, reason: response?.error || 'Unknown error',status:false });
      }
    }

    return res.status(200).json({
      message: 'Excel processed',
      total: rows.length,
      successCount: success.length,
      failedCount: failed.length,
      success,
      failed,status:true 
    });
  } catch (err) {
    console.error('❌ Upload Error:', err);
    return res.status(500).json({ error: 'Failed to process Excel file', details: err.message,status:false  });
  }
});

module.exports = router;
