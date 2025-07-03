const dbUtility = require("./dbUtility.js");
class exeQuery {
    //  //#region Menu
    GetMenu(JsonData, callback) {
        /*const sqlQuery = `
            SELECT *
        FROM V_RoleMenu
        WHERE RoleId = ${JsonData.RoleId} AND (OrgId = ${JsonData.OrgId} OR OrgId = 31113);
        `;*/
        const sqlQuery = `SELECT * FROM V_RoleMenu WHERE RoleId = ${JsonData.RoleId}
        AND EXISTS (SELECT 1 FROM RoleMenu WHERE RoleId = ${JsonData.RoleId})
        UNION ALL
        SELECT * FROM V_RoleMenu WHERE RoleId = ${JsonData.RoleId}  AND OrgId = 31113 
        AND NOT EXISTS (SELECT 1 FROM RoleMenu WHERE  RoleId = ${JsonData.RoleId}) ORDER BY SortOrder;`;
        console.log(sqlQuery);
        dbUtility.executeQuery(sqlQuery)
            .then(results => callback(null, results))
            .catch(callback);
    }
    
    GetMenuNodes(results,callback){
        if (!results || results.length === 0) {
            return callback(new Error('no Results'));
        }
        const menuNodes = this.buildMenuHierarchy(results);
        // Output the menu Nodes as JSON
        callback(null, menuNodes);
    }
    
    // Function to build menu hierarchy supporting multiple sublevels
    buildMenuHierarchy(menuItems) {
        // Step 1: Lookup object for all menu items by their AppMenuId
        const menuLookup = {};
        menuItems.forEach(menu => {
        menuLookup[menu.AppMenuId] = { 
            AppMenuId: menu.AppMenuId, 
            ReportId: menu.ReportId,
            label: menu.MenuName,
            link: menu.MenuPath,
            icon: menu.IconName,
            submenuItems: [] };
        });
    
        // Step 2: Organize the items into the correct hierarchy
        const rootMenus = [];
    
        menuItems.forEach(menu => {
        if (menu.ParentId === 0) {
            // It's a root menu
            rootMenus.push(menuLookup[menu.AppMenuId]);
        } else {
            // It's a child, so add it to its parent's SubItems array
            if (menuLookup[menu.ParentId]) {
            menuLookup[menu.ParentId].submenuItems.push(menuLookup[menu.AppMenuId]);
            }
        }
        });
        return rootMenus; // Return the structured menu hierarchy
    }
    
    // This is the older version hardcoded
    GetMenuItems(results, callback) {
        if (!results) {
            return callback(new Error('Results are undefined'));
        }
        //console.log(results);
        let MenuCategories = {
            Dashboard: {},
            Masters: {},
            Products: {},
            Purchases: {},
            //Sales: {},
            //Expenses: {},
            SalesReports: {},
            InventoryReports: {},
            StockReports: {}
        };

        results.forEach(item => {
            if (MenuCategories.hasOwnProperty(item.MenuName)) {
                console.log(item.MenuName);
                const AppmenuId = item.AppMenuId;

                let submenuItems = [];
                results.forEach(subItem => {
                    if (subItem.ParentId === AppmenuId) {
                        submenuItems.push(subItem);
                    }
                });
                if (submenuItems.length > 0) {
                    MenuCategories[item.MenuName] = {
                        items: submenuItems
                    };
                }
            }
        });

        callback(null, MenuCategories);
    }
    
    
    //#endregion Menu
    SpSetRoleSecurity(TotJson, callback) {
        if (!TotJson) {
            return callback(new Error('RoleSecurity is undefined'));
        }
        const { orgid, RoleId, MenuId, IsChecked, CanWrite, CanDelete, CanExport, userid } = TotJson;
        console.log(TotJson);

        const sqlQuery = `
            EXEC [dbo].[SP_SetRoleSecurity]
            @orgid = '${orgid}',
            @RoleId = '${RoleId}',
            @MenuId = '${MenuId}',
            @IsChecked = '${IsChecked}',
            @CanWrite = '${CanWrite}',
            @CanDelete = '${CanDelete}',
            @CanExport = '${CanExport}',
            @UpdatedBy = '${userid}'
        `;

        console.log('sqlQuery:', sqlQuery);

        dbUtility.executeQuery(sqlQuery)
            .then(results => callback(null, results))
            .catch(callback);
    }
}

module.exports = new exeQuery();



/*

insertpurchaseorder ,
utilityenumfile 
inventoryfile 
productservices 
dashboard serive counts
*/