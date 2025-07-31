const express = require("express");
const dbUtility = require("./dbUtility.js");
const { OperationEnums } = require("./utilityEnum.js");
const  exeQuery  = require("./exeQuery.js");

// const app = express();
const router = express.Router();
// const cors = require("cors");
// const port = process.env.PORT || 3080;

// app.use(cors());
// app.use(express.json());
// app.use("/api", router);

const executeStoredProcedure = (req, res, data, operationId) => {
  const jsonData = JSON.stringify(data);
  const sqlQuery = `
          DECLARE @ResultMessage NVARCHAR(MAX);
          DECLARE @STATUS NVARCHAR(MAX); 
          EXEC [dbo].[SP_ScreenOperations]
              @OperationId = '${operationId}',
              @JsonData = '${jsonData}',
              @ResultMessage = @ResultMessage OUTPUT,
              @STATUS = @STATUS OUTPUT; 
          SELECT @ResultMessage AS ResultMessage, @STATUS AS Status; 
      `;

  console.log(sqlQuery);
  dbUtility
    .executeQuery(sqlQuery)
    .then((results) => handleResponse(res, null, results))
    .catch((error) => handleResponse(res, error, null));
};

const handleResponse = (res, error, results) => {
  if (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  } else if (results && results.length > 0) {
    res.json({ ResultData: results, Status: true });
  } else {
    res.status(200).json({ error: "No records found", Status: false });
  }
};

const handleRecord = (req, res, data, operationId) => {
  executeStoredProcedure(req, res, data, operationId);
};


const handleResponseWithOutRes = (error, results) => {
    // console.log('handleResponseWithOutRes',results)
  if (error) {
    console.error("Error:", error);
    return { error: "Internal Server Error", Status: false };
  } else if (results && results.length > 0) {
    return { ResultData: results, Status: true };
  } else {
    return { error: "No records found", Status: false };
  }
};

const executeStoredProcedureWithOutRes = (data, operationId) => {
  const jsonData = JSON.stringify(data);
  const sqlQuery = `
          DECLARE @ResultMessage NVARCHAR(MAX);
          DECLARE @STATUS NVARCHAR(MAX); 
          EXEC [dbo].[SP_ScreenOperations]
              @OperationId = '${operationId}',
              @JsonData = '${jsonData}',
              @ResultMessage = @ResultMessage OUTPUT,
              @STATUS = @STATUS OUTPUT; 
          SELECT @ResultMessage AS ResultMessage, @STATUS AS Status; 
      `;

  console.log(sqlQuery);
  dbUtility
    .executeQuery(sqlQuery)
    .then((results) => handleResponseWithOutRes(null, results))
    .catch((error) => handleResponseWithOutRes(error, null));
};



const handleRecordWithOutRes = (data, operationId) => {
  executeStoredProcedureWithOutRes(data, operationId);
};

//region Filter types
router.get("/getFilterTypes", (req, res) => {
  const data = {};
  handleRecord(req, res, data, OperationEnums().GETFILTERTYPES);
});

router.post("/addFilterType", async (req, res) => {
  const data = { ...req.body };
  handleRecord(req, res, data, OperationEnums().ADDFILTERTYPE);
});

router.post("/updateFilterType", async (req, res) => {
  const data = req.body;
  handleRecord(req, res, data, OperationEnums().UPDATEFILTERTYPE);
});

router.post("/updateFilterTypeStatus", async (req, res) => {
  const data = req.body;
  handleRecord(req, res, data, OperationEnums().UPDATEFILTERTYPESTATUS);
});

//region AHU
router.get("/getAhuListold", (req, res) => {
  const data = {};
  handleRecord(req, res, data, OperationEnums().GETAHULIST);
});

router.post("/addAhuold", async (req, res) => {
  const data = { ...req.body };
  handleRecord(req, res, data, OperationEnums().ADDAHU);
});

router.post("/updateAhuold", async (req, res) => {
  const data = req.body;
  handleRecord(req, res, data, OperationEnums().UPDATEAHU);
});

router.post("/updateAhuIsActive", async (req, res) => {
  const data = req.body;
  handleRecord(req, res, data, OperationEnums().UPDATEAHUISACTIVE);
});

//region Users
router.get("/getUsers", (req, res) => {
  const data = {};
  handleRecord(req, res, data, OperationEnums().GETUSERS);
});

// app.listen(port, () => {
//   console.log(`services running on port ${port}`);
// });

router.get('/getmenu', (req, res) => {
    const {RoleId } = req.query;
    const JsonData = { "RoleId":RoleId };
    exeQuery.GetMenu(JsonData, (error, results) => {
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        console.log('results :',results)
        //console.log(results);
        exeQuery.GetMenuNodes(results, (err, MenuList) => {
            if (err) {
                return res.status(500).json({ error: err.message, Status: false });
            }
            res.json({
                ResultData: MenuList,
                Status: true
            });
        });
    });
});



router.get('/GetBarcodeType', (req, res) => {
    const data = req.query;
    handleRecord(req, res, data, OperationEnums().GETBCTYPE);
});

// router.post('/AddAHUFilter', (req, res) => {
//     const data = req.body;
//     // Generate base from current datetime (YYYYMMDDHHmmss)
//     const now = new Date();
//     const pad = (n) => n.toString().padStart(2, '0');

//     const year = now.getFullYear();
//     const month = pad(now.getMonth() + 1);
//     const day = pad(now.getDate());
//     const hours = pad(now.getHours());
//     const minutes = pad(now.getMinutes());
//     const seconds = pad(now.getSeconds());

//     // Use timestamp to ensure uniqueness
//     const timestamp = `${year}${month}${day}${hours}${minutes}${seconds}`; // e.g. 20250704123045

//     // Generate values
//     const barcode = timestamp.slice(-8); // Last 8 digits only
//     data.FilterId = `FLT${barcode.slice(-4)}`;
//     data.Barcode = barcode;
//     // data.Lable = `LBL${barcode}`;
//     console.log(data);

//     handleRecord(req, res, data, OperationEnums().AddAHUFilter);
// });

router.post('/AddAHUFilter', (req, res) => {
    const pad = (n) => n.toString().padStart(2, '0');
    const now = new Date();
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const barcode = timestamp.slice(-8);

    // Update NewValues with generated keys
    req.body.NewValues.FilterId = `FLT${barcode.slice(-4)}`;
    req.body.NewValues.Barcode = barcode;

    // Construct the full payload with ScreenOperationId and Approvaltype
    const totaldata = {
        ...req.body,
        ScreenOperationId: OperationEnums().AddAHUFilter,
        Approvaltype: 1,
        OldValues: {}
    };

    console.log(totaldata.NewValues);

    handleRecord(req, res, totaldata, OperationEnums().addApprovalSetting);
});

router.get('/getAHUIds', (req, res) => {
    const data = {};
    handleRecord(req, res, data, OperationEnums().getAHUId);
});

router.get('/getFilterType', (req, res) => {
    const data = {};
    handleRecord(req, res, data, OperationEnums().getFilterType);
});

router.get('/getLocationType', (req, res) => {
    const data = {};
    handleRecord(req, res, data, OperationEnums().getLocationType);
});

// router.get('/getFiltersList', (req, res) => {
//     // const data = {};
//     const {BlockId,Status,Barcode } = req.query;
//     if BlockId == 0:
//       BlockId = ' b.BlockId'
//     if Status == 0:
//       Status = 'pa.Status'
//     if Barcode == 0:
//       Barcode = 'pa.Barcode'
//     else :
//       Barcode = f'{Barcode}'

//     data = {BlockId:BlockId,Status:Status,Barcode:Barcode}
//     handleRecord(req, res, data, OperationEnums().getFiltersList);
// });

router.get('/getFiltersList', (req, res) => {
    let { BlockId, Status, Barcode } = req.query;

    if (BlockId == 0 || BlockId === undefined) {
        BlockId = 'b.BlockId';
    }

    if (Status == 0 || Status === undefined) {
        Status = 'pa.Status';
    }

    if (Barcode == 0 || Barcode === undefined) {
        Barcode = 'pa.Barcode';
    } else {
        Barcode = `${Barcode}`;
    }
    const data = { BlockId, Status, Barcode };

    handleRecord(req, res, data, OperationEnums().getFiltersList);
});

router.post('/CheckOrderedStage', (req, res) => {
    const data = req.body;
    handleRecord(req, res, data, OperationEnums().CheckOrderedStage);
});


router.get('/GetFilterStatus', (req, res) => {
    const data = req.query;
    handleRecord(req, res, data, OperationEnums().getFilterHistory);
});

// router.post('/AddFilterHistory', (req, res) => {
//     const data = req.body;
//     handleRecordWithOutRes(req, res, data, OperationEnums().AddFilterHistory);
    
// });

router.post('/UpdateFilterStatus', async (req, res) => {
  const dataArray = req.body;

  if (!Array.isArray(dataArray)) {
    return res.status(400).json({ ResultMessage: "Request body must be an array", Status: false,ResultData:[]  });
  }

  let results = [];

  for (const data of dataArray) {
    try {
      console.log('data :',data)
      // Assuming handleRecordWithOutRes returns a result object
      const result = await handleRecordWithOutRes( data, OperationEnums().AddFilterHistory);
      results.push({ Barcode: data.Barcode, result });
    } catch (error) {
      results.push({ Barcode: data.Barcode, result: { ResultMessage: "Failed to insert", Status: false,ResultData:[] } });
    }
  }

  res.json({
    ResultMessage: "Processed all records",
    Status: true,
    ResultData: results
  });
});


router.get('/GetMastersEquipment', (req, res) => {
    const data = req.query;
    handleRecord(req, res, data, OperationEnums().GetMastersEquipment);
});

router.get('/GetMastersReasons', (req, res) => {
    const data = req.query;
    handleRecord(req, res, data, OperationEnums().GetMastersReasons);
});

router.get('/GetMastersPressure', (req, res) => {
    const data = req.query;
    handleRecord(req, res, data, OperationEnums().GetMastersPressure);
});

router.get('/getAllUsers', (req, res) => {
    const data = {};
    handleRecord(req, res, data, OperationEnums().getAllUsers);
});

router.post('/updateTermination', (req, res) => {
    const data = req.body;
    handleRecord(req, res, data, OperationEnums().updateTermination);
});

router.post('/updateUserInfo', (req, res) => {
    const data =  req.body;
    handleRecord(req, res, data, OperationEnums().updateuser);
});

router.get('/getStageCount', (req, res) => {
    const data = {};
    handleRecord(req, res, data, OperationEnums().getStageCount);
});

// router.post('/updateFilter', (req, res) => {
//     const data = req.body;
//     handleRecord(req, res, data, OperationEnums().updateFiltersList);
// });

// router.post('/AddAHU', (req, res) => {
//     const data = req.body;
//     handleRecord(req, res, data, OperationEnums().AddAHUEnum);
// });

// router.post('/updateAHU', (req, res) => {
//     const data = req.body;
//     handleRecord(req, res, data, OperationEnums().updateAHUEnum);
// });

router.post('/updateAHUstatus', (req, res) => {
    const data = req.body;
    handleRecord(req, res, data, OperationEnums().deleteAHU);
});


router.get('/getAHUList', (req, res) => {
    let { location } = req.query;

    if (location == 0 || location === undefined) {
        location = 'phs.location';
    }

    
    const data = { location };

    handleRecord(req, res, data, OperationEnums().getAHUListEnum);
});

router.get('/getAssetType', (req, res) => {
    const data = {};
    handleRecord(req, res, data, OperationEnums().getAssetType);
});

router.post('/updateAssetTypestatus', (req, res) => {
    const data = req.body;
    handleRecord(req, res, data, OperationEnums().deleteAssetType);
});

router.post('/updateAssetType', (req, res) => {
    const data = req.body;
    handleRecord(req, res, data, OperationEnums().updateAssetType);
});

router.post('/AddAssetType', (req, res) => {
    const data = req.body;
    handleRecord(req, res, data, OperationEnums().AddAssetType);
});




router.get('/getMaintenanceStages', (req, res) => {
    const data = {};
    handleRecord(req, res, data, OperationEnums().getMaintenanceStages);
});

router.post('/addMaintenanceStages', (req, res) => {
    const data = req.body;
    handleRecord(req, res, data, OperationEnums().addMaintenanceStages);
});

router.post('/updateMaintenanceStages', (req, res) => {
    const data = req.body;
    handleRecord(req, res, data, OperationEnums().updateMaintenanceStages);
});

router.post('/updateMaintenanceStagesstatus', (req, res) => {
    const data = req.body;
    handleRecord(req, res, data, OperationEnums().deleteMaintenanceStages);
});

router.get('/getlocations', (req, res) => {
    const data = {};
    handleRecord(req, res, data, OperationEnums().getlocations);
});

router.post('/addlocations', (req, res) => {
    const data = req.body;
    handleRecord(req, res, data, OperationEnums().addlocations);
});

router.post('/editlocations', (req, res) => {
    const data = req.body;
    handleRecord(req, res, data, OperationEnums().editlocations);
});

router.post('/updatelocationsstatus', (req, res) => {
    const data = req.body;
    handleRecord(req, res, data, OperationEnums().deletelocations);
});

router.post('/AddWashInReasons', (req, res) => {
    const data = req.body;
    handleRecord(req, res, data, OperationEnums().AddWashInReasons);
});

router.post('/updateWashInReasons', (req, res) => {
    const data = req.body;
    handleRecord(req, res, data, OperationEnums().updateWashInReasons);
});
router.post('/updateWashInReasonsstatus', (req, res) => {
    const data = req.body;
    handleRecord(req, res, data, OperationEnums().deleteWashInReasons);
});

router.get('/getWashInReasons', (req, res) => {
    const data = {};
    handleRecord(req, res, data, OperationEnums().getWashInReasons);
});

router.post('/addPressure', (req, res) => {
    const data = req.body;
    handleRecord(req, res, data, OperationEnums().addPressure);
});

// router.post('/updatePressure', (req, res) => {
//     const data = req.body;
//     handleRecord(req, res, data, OperationEnums().updatePressure);
// });



router.post('/updatePressurestatus', (req, res) => {
    const data = req.body;
    handleRecord(req, res, data, OperationEnums().updatePressure);
});


router.get('/getPressure', (req, res) => {
    const data = req.query;
    handleRecord(req, res, data, OperationEnums().getPressure);
});

router.get('/getEquipments', (req, res) => {
    // const data = req.query;

    let { Isdryer,blockid } = req.query;

    if (blockid == 0 || blockid === undefined) {
        blockid = 'pe.blockid';
    }

    
    const data = { Isdryer,blockid};
    handleRecord(req, res, data, OperationEnums().getEquipments);
});

router.post('/addEquipments', (req, res) => {
    const data = req.body;
    handleRecord(req, res, data, OperationEnums().addEquipments);
});
router.post('/updateEquipments', (req, res) => {
    const data = req.body;
    handleRecord(req, res, data, OperationEnums().updateEquipments);
});
router.post('/updateEquipmentsstatus', (req, res) => {
    const data = req.body;
    handleRecord(req, res, data, OperationEnums().deleteEquipments);
});

router.get('/getUserDashboardCount', (req, res) => {

    const data = {};
    handleRecord(req, res, data, OperationEnums().getUserDashboardCount);
});


router.get('/getAdminDashboardCount', (req, res) => {
    const data = {};
    handleRecord(req, res, data, OperationEnums().getAdminDashboardCount);
});

router.get('/getbarGraph', (req, res) => {
    const data = {};
    handleRecord(req, res, data, OperationEnums().getbarGraph);
});


// router.get('/getmenu', (req, res) => {
//     const {RoleId } = req.query;
//     const JsonData = { "RoleId":RoleId };
//     exeQuery.GetMenu(JsonData, (error, results) => {
//         if (error) {
//             return res.status(500).json({ error: error.message });
//         }
//         //console.log(results);
//         exeQuery.GetMenuNodes(results, (err, MenuList) => {
//             if (err) {
//                 return res.status(500).json({ error: err.message, Status: false });
//             }
//             res.json({
//                 ResultData: MenuList,
//                 Status: true
//             });
//         });
//     });
// });


router.post('/updatePressure', (req, res) => {
    const data = {...req.body,ScreenOperationId:OperationEnums().updatePressure,Approvaltype:2};
    console.log(data)
    handleRecord(req, res, data, OperationEnums().addApprovalSetting);
});

router.get('/getApprovalSetting', (req, res) => {
    const data = {}
    handleRecord(req, res, data, OperationEnums().getApprovalSetting);
});

router.post('/updateApprovalSetting', (req, res) => {
    const data = req.body
    handleRecord(req, res, data, OperationEnums().updateApprovalSetting);
});

router.post('/updateFilter', (req, res) => {
    // const data = req.body;
    // handleRecord(req, res, data, OperationEnums().updateFiltersList);
    const data = {...req.body,ScreenOperationId:OperationEnums().updateFiltersList,Approvaltype:2};
    console.log(data)
    handleRecord(req, res, data, OperationEnums().addApprovalSetting);
});

router.post('/updateAHU', (req, res) => {
    // const data = req.body;
    // handleRecord(req, res, data, OperationEnums().updateAHUEnum);
    const data = {...req.body,ScreenOperationId:OperationEnums().updateAHUEnum,Approvaltype:2};
    console.log(data)
    handleRecord(req, res, data, OperationEnums().addApprovalSetting);
});

router.post('/AddAHU', (req, res) => {
    // const data = req.body;
    // handleRecord(req, res, data, OperationEnums().AddAHUEnum);

    const data = {...req.body,ScreenOperationId:OperationEnums().AddAHUEnum,Approvaltype:1,OldValues: {}};
    console.log(data)
    handleRecord(req, res, data, OperationEnums().addApprovalSetting);
});

router.get('/api/save-cleaning-schedule', async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let insertedSchedules = [];
      const result = await handleRecordWithOutRes( data, OperationEnums().AddFilterHistory);

        const ahuResult = await pool.request().query(`
            SELECT AHUId, InstalledOn, IntervalDays, ValidOperationLife
            FROM AHUDetails
            WHERE CurrentStatus = 'Active'
        `);

        for (const row of ahuResult.recordset) {
            const ahuId = row.AHUId;
            const installedOn = new Date(row.InstalledOn);
            const interval = row.IntervalDays;
            const validDays = row.ValidOperationLife;
            const expiryDate = new Date(installedOn.getTime() + validDays * 24 * 60 * 60 * 1000);

            // Get last scheduled date
            const lastScheduleResult = await pool.request()
                .input('AHUId', sql.Int, ahuId)
                .query(`
                    SELECT TOP 1 ScheduledDate 
                    FROM AHUCleaningSchedule 
                    WHERE AHUId = @AHUId 
                    ORDER BY ScheduledDate DESC
                `);

            let lastScheduleDate = lastScheduleResult.recordset.length > 0
                ? new Date(lastScheduleResult.recordset[0].ScheduledDate)
                : installedOn;

            const nextDueDate = new Date(lastScheduleDate.getTime() + interval * 24 * 60 * 60 * 1000);

            // Compare only date part
            if (
                nextDueDate.toDateString() === today.toDateString() &&
                nextDueDate <= expiryDate
            ) {
                // Check if already inserted
                const existsResult = await pool.request()
                    .input('AHUId', sql.Int, ahuId)
                    .input('ScheduledDate', sql.Date, nextDueDate)
                    .query(`
                        SELECT COUNT(*) AS count 
                        FROM AHUCleaningSchedule 
                        WHERE AHUId = @AHUId AND ScheduledDate = @ScheduledDate
                    `);

                if (existsResult.recordset[0].count === 0) {
                    await pool.request()
                        .input('AHUId', sql.Int, ahuId)
                        .input('ScheduledDate', sql.Date, nextDueDate)
                        .query(`
                            INSERT INTO AHUCleaningSchedule (AHUId, ScheduledDate)
                            VALUES (@AHUId, @ScheduledDate)
                        `);

                    insertedSchedules.push({
                        AHUId: ahuId,
                        ScheduledDate: nextDueDate.toISOString().slice(0, 10)
                    });
                }
            }
        }

        res.json({
            message: `${insertedSchedules.length} schedule(s) added`,
            schedules: insertedSchedules
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


router.get('/getRoleMenu', (req, res) => {
    const data = req.query;
    handleRecord(req, res, data, OperationEnums().getRoleMenu);
});

router.post('/updateRoleMenu', (req, res) => {
    const data = req.body;
    handleRecord(req, res, data, OperationEnums().updateRoleMenu);
});

router.get('/getRoles', (req, res) => {
    const data = {};
    handleRecord(req, res, data, OperationEnums().getRoles);
});

router.get('/GetSchedules', (req, res) => {
    let { BlockId } = req.query;

    if (BlockId == 0 || BlockId === undefined) {
        BlockId = 'b.BlockId';
    }
    const data = { BlockId };
    handleRecord(req, res, data, OperationEnums().GetSchedules);
});

router.get('/GetTasks', (req, res) => {
    let { BlockId, startdate, enddate } = req.query;

    // Default fallback if value is 0 or undefined
    BlockId = (BlockId == 0 || BlockId === undefined) ? 'b.BlockId' : BlockId;

    // // Wrap dates in single quotes only if valid, else use column reference
    // startdate = (startdate == 0 || startdate === undefined) ? 'acs.ScheduledDate' : startdate;
    // enddate = (enddate == 0 || enddate === undefined) ? 'acs.ScheduledDate' : enddate;

    const data = { BlockId, startdate, enddate };
    console.log('Query Data:', data);

    handleRecord(req, res, data, OperationEnums().GetTasks);
});

router.post('/canceltasks', (req, res) => {
    const data = req.body;
    handleRecord(req, res, data, OperationEnums().canceltasks);
});

router.post('/addFilterReplaceOrRetirement', (req, res) => {
    const data = req.body;
    handleRecord(req, res, data, OperationEnums().addFilterReplaceOrRetirement);
});


router.get('/getReplacementList', (req, res) => {
    let { BlockId, Status, Barcode } = req.query;

    if (BlockId == 0 || BlockId === undefined) {
        BlockId = 'b.BlockId';
    }

    if (Barcode == 0 || Barcode === undefined) {
        Barcode = 'pa.Barcode';
    } else {
        Barcode = `${Barcode}`;
    }
    const data = { BlockId, Status, Barcode };

    handleRecord(req, res, data, OperationEnums().getReplacementList);
});

router.get('/getRetirementList', (req, res) => {
    let { BlockId, Status, Barcode } = req.query;

    if (BlockId == 0 || BlockId === undefined) {
        BlockId = 'b.BlockId';
    }

    if (Barcode == 0 || Barcode === undefined) {
        Barcode = 'pa.Barcode';
    } else {
        Barcode = `${Barcode}`;
    }
    const data = { BlockId, Status, Barcode };

    handleRecord(req, res, data, OperationEnums().getRetirementList);
});



router.post('/AddprinterIpAdress', (req, res) => {
    const data = req.body;
    handleRecord(req, res, data, OperationEnums().AddprinterIpAdress);
});


router.post('/EditprinterIpAdress', (req, res) => {
    const data = req.body;
    handleRecord(req, res, data, OperationEnums().EditprinterIpAdress);
});


router.post('/deleteprinterIpAdress', (req, res) => {
    const data = req.body;
    handleRecord(req, res, data, OperationEnums().deleteprinterIpAdress);
});

router.get('/getprinterIpAdress', (req, res) => {
    const data = {  };
    handleRecord(req, res, data, OperationEnums().getprinterIpAdress);
});

router.get('/getbarcodereport', (req, res) => {
    let { FilterId, startdate, enddate } = req.query;

    FilterId = (FilterId == 0 || FilterId === undefined) ? 'pa.FilterId' : FilterId;


    const data = { FilterId, startdate, enddate };
    console.log('Query Data:', data);
    handleRecord(req, res, data, OperationEnums().getbarcodereport);
});


// module.exports = router;
module.exports = {
  router,
  handleRecordWithOutRes,
};