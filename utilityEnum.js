function OperationEnums() {
  const Operations = {
    GETFILTERTYPES: 1,
    ADDFILTERTYPE: 2,
    UPDATEFILTERTYPE: 3,
    UPDATEFILTERTYPESTATUS: 4,
    GETAHULIST: 17,
    ADDAHU: 18,
    UPDATEAHU: 19,
    UPDATEAHUISACTIVE: 20,
    GETUSERS: 21,
    GETBCTYPE: 25,
    AddAHUFilter:200,
    getAHUId:201,
    getFilterType:202,
    getLocationType:203,
    getFiltersList:204,
    CheckOrderedStage:205,
    getFilterHistory:206,
    AddFilterHistory:207,
    GetMastersEquipment:27,
    GetMastersReasons:28,
    GetMastersPressure:29,
    getAllUsers:30,
    getStageCount:208,
    updateFiltersList:209,
  };
  return Operations;
}
module.exports = {
  OperationEnums,
};
