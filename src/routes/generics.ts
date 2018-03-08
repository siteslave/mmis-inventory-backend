'use strict';

import * as express from 'express';
import * as moment from 'moment';
import * as co from 'co-express';

import { GenericModel } from '../models/generic';
const router = express.Router();

const genericModel = new GenericModel();

router.get('/types', co(async (req, res, next) => {
  let db = req.db;
  let productGroups = req.decoded.generic_type_id;
  let _pgs = [];

  if (productGroups) {
    let pgs = productGroups.split(',');
    pgs.forEach(v => {
      _pgs.push(v);
    });

    try {
      let rs = await genericModel.getGenericTypes(db, _pgs);

      res.send({ ok: true, rows: rs });
    } catch (error) {
      res.send({ ok: false, error: error.message });
    } finally {
      db.destroy();
    }
  } else {
    res.send({ ok: false, error: 'ไม่พบการกำหนดเงื่อนไขประเภทสินค้า' });
  }

}));

router.get('/search-autocomplete', async (req, res, next) => {

  let db = req.db;
  let q = req.query.q;
  try {
    let rs: any = await genericModel.searchAutocomplete(db, q);
    if (rs.length) {
      res.send(rs);
    } else {
      res.send([]);
    }
  } catch (error) {
    res.send({ ok: false, error: error.messgae });
  } finally {
    db.destroy();
  }
});
router.get('/warehouse/search/autocomplete', async (req, res, next) => {

  let db = req.db;
  let q = req.query.q;
  let warehouseId = req.decoded.warehouseId;

  try {
    let rs: any = await genericModel.warehouseSearchAutocomplete(db, warehouseId, q);
    res.send(rs);
  } catch (error) {
    console.log(error);

    res.send({ ok: false, error: error.messgae });
  } finally {
    db.destroy();
  }
});
router.get('/search-warehouse-zero-autocomplete', co(async (req, res, next) => {

  let db = req.db;
  let query = req.query.q;
  let warehouseId = req.query.warehouseId;

  try {
    let rs = await genericModel.searchGenericZeroWarehouse(db, query, warehouseId);
    if (rs[0].length) {
      res.send(rs[0]);
    } else {
      res.send([]);
    }
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }

}));
router.post('/allocate', async (req, res, next) => {

  let db = req.db;
  let _data: any = req.body.data;
  let warehouseId = req.body.srcWarehouseId || req.decoded.warehouseId;

  try {
    let genericIds = [];
    _data.forEach(v => {
      genericIds.push(v.genericId);
    });

    let items = [];
    let rsProducts: any = await genericModel.getProductInWarehousesByGenerics(db, genericIds, warehouseId);
    _data.forEach(v => {
      let obj: any = {};
      obj.generic_id = v.genericId;
      obj.generic_qty = v.genericQty;
      obj.products = [];
      rsProducts.forEach(x => {
        if (+x.generic_id === +v.genericId) {
          obj.products.push(x);
        }
      });
      items.push(obj);
    });

    let results = [];
    items.forEach((v) => {
      let genericQty = v.generic_qty;
      let products = v.products;
      products.forEach((x, i) => {
        let obj: any = {};
        obj.wm_product_id = x.wm_product_id;
        obj.unit_generic_id = x.unit_generic_id;
        obj.conversion_qty = x.conversion_qty;
        obj.generic_id = v.generic_id;
        obj.pack_remain_qty = x.pack_remain_qty;
        obj.small_remain_qty = x.remain_qty;
        obj.product_name = x.product_name;
        obj.from_unit_name = x.from_unit_name;
        obj.to_unit_name = x.to_unit_name;
        obj.expired_date = x.expired_date;
        obj.lot_no = x.lot_no;
        obj.product_id = x.product_id;

        if (x.remain_qty >= genericQty && i !== (products.length - 1)) {
          if ((genericQty % x.conversion_qty) === 0) {
            obj.product_qty = genericQty / x.conversion_qty;
            x.remain_qty = x.remain_qty - (obj.product_qty * x.conversion_qty);
            genericQty = 0;
          } else {
            obj.product_qty = Math.floor(genericQty / x.conversion_qty);
            x.remain_qty = x.remain_qty - (obj.product_qty * x.conversion_qty);
            genericQty = genericQty - (obj.product_qty * x.conversion_qty);
          }
        } else {
          if (i === (products.length - 1)) {
            if (x.remain_qty >= genericQty) {
              if ((genericQty % x.conversion_qty) === 0) {
                obj.product_qty = genericQty / x.conversion_qty;
                x.remain_qty = x.remain_qty - (obj.product_qty * x.conversion_qty);
                genericQty = genericQty - (obj.product_qty * x.conversion_qty);
              } else {
                obj.product_qty = Math.ceil(genericQty / x.conversion_qty);
                x.remain_qty = x.remain_qty - (obj.product_qty * x.conversion_qty);
                genericQty = genericQty - (obj.product_qty * x.conversion_qty);
              }
            } else {
              if ((x.remain_qty % x.conversion_qty) === 0) {
                obj.product_qty = x.remain_qty / x.conversion_qty;
                x.remain_qty = x.remain_qty - (obj.product_qty * x.conversion_qty);
                genericQty = genericQty - (obj.product_qty * x.conversion_qty);
              } else {
                obj.product_qty = Math.ceil(x.remain_qty / x.conversion_qty);
                x.remain_qty = x.remain_qty - (obj.product_qty * x.conversion_qty);
                genericQty = genericQty - (obj.product_qty * x.conversion_qty);
              }
            }
          } else {
            if (x.remain_qty >= genericQty) {
              if ((genericQty % x.conversion_qty) === 0) {
                obj.product_qty = x.genericQty / x.conversion_qty;
                x.remain_qty = x.remain_qty - (obj.product_qty * x.conversion_qty);
                genericQty = 0;
              } else {
                obj.product_qty = Math.floor(genericQty / x.conversion_qty);
                x.remain_qty = x.remain_qty - (obj.product_qty * x.conversion_qty);
                genericQty = genericQty - (obj.product_qty * x.conversion_qty);
              }
            } else {
              if ((x.remain_qty % x.conversion_qty) === 0) {
                obj.product_qty = x.remain_qty / x.conversion_qty;
                x.remain_qty = x.remain_qty - (obj.product_qty * x.conversion_qty);
                genericQty = genericQty - (obj.product_qty * x.conversion_qty);
              } else {
                obj.product_qty = Math.floor(x.remain_qty / x.conversion_qty);
                x.remain_qty = x.remain_qty - (obj.product_qty * x.conversion_qty);
                genericQty = genericQty - (obj.product_qty * x.conversion_qty);
              }
            }
          }
        }

        results.push(obj);
      });
    });

    res.send({ ok: true, rows: results });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
});
export default router;