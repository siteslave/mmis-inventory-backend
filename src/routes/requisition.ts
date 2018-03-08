'use strict';

import * as express from 'express';
import * as moment from 'moment';

import * as co from 'co-express';
import * as uuid from 'uuid/v4';
import * as _ from 'lodash';

import { unitOfTime } from 'moment';
import { ReceiveModel } from '../models/receive';
import { ProductModel } from "../models/product";
import { LocationModel } from "../models/location";
import { WarehouseModel } from '../models/warehouse';
import { PeopleModel } from '../models/people';
import { StockCard } from '../models/stockcard';

import {
  IReceiveSummaryFields,
  IReceiveSummaryParams,
  IReceiveDetailFields,
  IReceiveDetailParams,
  IRequisitionSummaryParams,
  IRquisitiondetailParams,
  IConfirmSummaryFields,
  IConfirmSummaryParams,
  IConfirmProductParams,
  IConfirmProductFields,
  IWMProductsFields
} from '../models/model';

import { RequisitionModel } from '../models/requisition';
import { LotModel } from '../models/lot';
import { SerialModel } from '../models/serial';
import { RequisitionOrderModel } from '../models/requisitionOrder';
import { PeriodModel } from '../models/period';

const router = express.Router();

const requisitionModel = new RequisitionModel();
const productModel = new ProductModel();
const peopleModel = new PeopleModel();
const lotModel = new LotModel();
const stockCardModel = new StockCard();
const serialModel = new SerialModel();
const orderModel = new RequisitionOrderModel();
const periodModel = new PeriodModel();
/**
 * Requisition order
 * by @siteslave
 */

router.post('/orders', async (req, res, next) => {
  let db = req.db;
  let order: any = req.body.order;
  let products = req.body.products;
  let people_id = req.decoded.people_id;

  let year = moment(order.requisition_date, 'YYYY-MM-DD').get('year');
  let month = moment(order.requisition_date, 'YYYY-MM-DD').get('month') + 1;

  let isClose = await periodModel.isPeriodClose(db, year, month);

  if (isClose) {
    res.send({ ok: false, error: 'รอบบัญชีถูกปิดแล้ว' })
  } else {
    try {
      // get serial
      let serial = await serialModel.getSerial(db, 'RQ');
      order.requisition_code = serial;
      order.people_id = people_id;
      order.created_at = moment().format('YYYY-MM-DD HH:mm:ss');

      let rsOrder: any = await orderModel.saveOrder(db, order);
      let requisitionId = rsOrder[0];
      let items: any = [];

      products.forEach((v: any) => {
        let obj: any = {
          requisition_order_id: requisitionId,
          generic_id: v.generic_id,
          requisition_qty: v.requisition_qty, // small qty
          unit_generic_id: v.unit_generic_id
        }
        items.push(obj);
      });

      await orderModel.saveItems(db, items);
      res.send({ ok: true });
    } catch (error) {
      res.send({ ok: false, error: error.message });
    } finally {
      db.destroy();
    }
  }

});

router.put('/orders/:requisitionId', async (req, res, next) => {
  let db = req.db;
  let people_id = req.decoded.people_id;
  let requisitionId: any = req.params.requisitionId;
  let order: any = req.body.order;
  let products = req.body.products;

  let year = moment(order.requisition_date, 'YYYY-MM-DD').get('year');
  let month = moment(order.requisition_date, 'YYYY-MM-DD').get('month') + 1;

  let isClose = await periodModel.isPeriodClose(db, year, month);

  if (isClose) {
    res.send({ ok: false, error: 'รอบบัญชีถูกปิดแล้ว' })
  } else {

    try {
      let _order: any = {};
      _order.people_id = people_id;
      _order.updated_at = moment().format('YYYY-MM-DD HH:mm:ss');
      _order.requisition_type_id = order.requisition_type_id;

      let rsOrder: any = await orderModel.updateOrder(db, requisitionId, _order);

      let items: any = [];

      products.forEach((v: any) => {
        let obj: any = {
          requisition_order_id: requisitionId,
          generic_id: v.generic_id,
          requisition_qty: v.requisition_qty, // small qty
          unit_generic_id: v.unit_generic_id
        }
        items.push(obj);
      });

      await orderModel.removeItems(db, requisitionId);
      await orderModel.saveItems(db, items);
      res.send({ ok: true });
    } catch (error) {
      res.send({ ok: false, error: error.message });
    } finally {
      db.destroy();
    }
  }

});

router.get('/orders/waiting', async (req, res, next) => {

  let db = req.db;
  let warehouseId = req.decoded.warehouseId;
  try {
    let rs: any = await orderModel.getListWaiting(db, null, warehouseId);
    res.send({ ok: true, rows: rs[0] });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }

});

router.get('/orders/waiting-approve', async (req, res, next) => {

  let db = req.db;
  let warehouseId = req.decoded.warehouseId;

  try {
    let rs: any = await orderModel.getListWaitingApprove(db, null, warehouseId);
    res.send({ ok: true, rows: rs[0] });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }

});

router.get('/orders/approved', async (req, res, next) => {

  let db = req.db;
  let warehouseId = req.decoded.warehouseId;

  try {
    let rs: any = await orderModel.getListApproved(db, null, warehouseId);
    res.send({ ok: true, rows: rs });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }

});

router.get('/orders/detail/:requisitionId', async (req, res, next) => {

  let db = req.db;
  let requisitionId: any = req.params.requisitionId;

  try {
    let rs: any = await orderModel.getOrderDetail(db, requisitionId);
    res.send({ ok: true, detail: rs[0] });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }

});

router.get('/generics-requisition/:requisitionId', async (req, res, next) => {

  let db = req.db;
  let requisitionId: any = req.params.requisitionId;
  let warehouseId = req.decoded.warehouseId;

  let genericIds = [];

  try {
    let rs: any = await orderModel.getOrderItemsByRequisition(db, requisitionId);

    let rsGenerics: any = await requisitionModel.getGenericsFromRequisition(db, requisitionId);

    let _generics = rsGenerics[0];

    _generics.forEach(v => {
      genericIds.push(v.generic_id);
    });

    let rsProducts: any = await requisitionModel.getProductInWarehousesByGenerics(db, genericIds, warehouseId);
    let rsReqItems: any = await requisitionModel.getRequisitionOrderItems(db, requisitionId);

    let items = [];
    rsReqItems.forEach(v => {
      let obj: any = {};
      obj.generic_id = v.generic_id;
      obj.requisition_qty = v.requisition_qty;
      obj.products = [];
      rsProducts.forEach(x => {
        if (x.generic_id === v.generic_id) {
          let _obj: any = {};
          _obj.wm_product_id = x.wm_product_id;
          _obj.remain_qty = x.qty;
          _obj.reseve_qty = 0; // ยอดจอง จากรายการตัดจ่าย, โอน, เบิก, เติม ที่รออนุมัติ
          _obj.expired_date = x.expired_date;
          _obj.conversion_qty = x.conversion_qty;
          _obj.unit_generic_id = x.unit_generic_id;
          obj.products.push(_obj);
        }
      });
      items.push(obj);
    });

    let pays = [];

    items.forEach((v, i) => {
      let reqQty = v.requisition_qty;
      let products = v.products;

      products.forEach((x, z) => {
        let obj: any = {};
        obj.wm_product_id = x.wm_product_id;
        obj.unit_generic_id = x.unit_generic_id;
        obj.conversion_qty = x.conversion_qty;
        obj.generic_id = v.generic_id;
        obj.remain_qty = x.remain_qty;

        if (x.remain_qty >= reqQty && z !== (products.length - 1)) {
          if ((reqQty % x.conversion_qty) === 0) {
            obj.pay_qty = Math.floor(reqQty / x.conversion_qty);
            if (x.remain_qty >= reqQty) reqQty = 0;
          } else {
            obj.pay_qty = 0;
          }
        } else {
          if (z === (products.length - 1)) {
            if ((reqQty % x.conversion_qty) === 0 && x.remain_qty > 0) {
              obj.pay_qty = Math.floor(reqQty / x.conversion_qty);
            } else {
              obj.pay_qty = 0;
            }
          } else {
            if ((reqQty % x.conversion_qty) === 0 && x.remain_qty > 0) {
              obj.pay_qty = 0; // Math.floor(x.remain_qty / x.conversion_qty);
              reqQty -= x.remain_qty;
            } else {
              obj.pay_qty = 0;
            }
          }
        }

        pays.push(obj);
      });
    });

    res.send({ ok: true, rows: rs[0], pays: pays });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }

});

router.get('/generics-requisition/unpaid/:unpaidId', async (req, res, next) => {

  let db = req.db;
  let unpaidId: any = req.params.unpaidId;

  try {
    let rs: any = await orderModel.getOrderUnpaidItems(db, unpaidId);
    res.send({ ok: true, rows: rs[0] });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }

});

router.get('/generics-requisition/pay/:requisitionId/:confirmId', async (req, res, next) => {

  let db = req.db;
  let requisitionId: any = req.params.requisitionId;
  let confirmId: any = req.params.confirmId;

  try {
    let rs: any = await orderModel.getOrderItemsPayByRequisition(db, requisitionId, confirmId);
    res.send({ ok: true, rows: rs[0] });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }

});

router.get('/generics-requisition/for-edit/:requisitionId', async (req, res, next) => {

  let db = req.db;
  let requisitionId: any = req.params.requisitionId;

  try {
    let rs: any = await orderModel.getEditOrderItemsByRequisition(db, requisitionId);
    res.send({ ok: true, rows: rs });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }

});

router.get('/products-requisition/:genericId', async (req, res, next) => {

  let db = req.db;

  let warehouseId = req.decoded.warehouseId;
  let genericId: any = req.params.genericId;

  try {
    let rs: any = await orderModel.getOrderProductConfirmItemsByRequisition(db, warehouseId, genericId);
    res.send({ ok: true, rows: rs[0] });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }

});

router.get('/products-requisition/edit/:confirmId/:genericId', async (req, res, next) => {

  let db = req.db;

  let warehouseId = req.decoded.warehouseId;
  let confirmId: any = req.params.confirmId;
  let genericId: any = req.params.genericId;

  try {
    let rs: any = await orderModel.getEditOrderProductConfirmItemsByConfirm(db, confirmId, warehouseId, genericId);
    res.send({ ok: true, rows: rs[0] });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }

});

router.delete('/orders/:requisitionId', async (req, res, next) => {

  let db = req.db;
  let requisitionId: any = req.params.requisitionId;

  try {
    // get req detail
    let rs: any = await orderModel.getOrderDetail(db, requisitionId);
    if (rs.length) {
      if (moment(rs[0].requisition_date).isValid()) {
        let year = moment(rs[0].requisition_date, 'YYYY-MM-DD').get('year');
        let month = moment(rs[0].requisition_date, 'YYYY-MM-DD').get('month') + 1;

        let isClose = await periodModel.isPeriodClose(db, year, month);

        if (isClose) {
          res.send({ ok: false, error: 'บัญชีถูกปิดแล้ว' });
        } else {
          await orderModel.removeOrder(db, requisitionId);
          res.send({ ok: true });
        }
      } else {
        await orderModel.removeOrder(db, requisitionId);
        res.send({ ok: true });
      }

    } else {
      res.send({ ok: false, error: 'ไม่พบรายการที่ต้องการลบ' })
    }

  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }

});

router.get('/orders/unpaid', async (req, res, next) => {

  let db = req.db;
  let warehouseId = req.decoded.warehouseId;

  try {
    let rs: any = await orderModel.getUnPaidOrders(db, null, warehouseId);
    res.send({ ok: true, rows: rs[0] });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }

});

// router.post('/orders/approve/:requisitionId', async (req, res, next) => {
//   let requisitionId = req.params.requisitionId;
//   let db = req.db;
//   let approve = req.body.approve;
//   let approveItems = req.body.items;

//   try {
//     // save approve
//     let rsApprove: any = await orderModel.saveApprove(db, approve);
//     let approveId = rsApprove[0];

//     let _items = [];
//     approveItems.forEach((v: any) => {
//       let obj: any = {};
//       obj.approve_id = approveId;
//       obj.product_new_id = v.product_new_id;
//       obj.approve_qty = v.approve_qty;
//       obj.generic_id = v.generic_id;

//       _items.push(obj);
//     });

//   } catch (error) {
//     res.send({ ok: false, error: error.message });
//   } finally {
//     db.destroy();
//   }

// });

/***********************  Confrim ***********************/

router.delete('/orders/confirm/:confirmId', async (req, res, next) => {
  let db = req.db;
  let confirmId = req.params.confirmId;

  try {
    // await orderModel.removeConfirm(db, confirmId);
    await orderModel.removeConfirmOrder(db, confirmId);

    res.send({ ok: true });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
});

router.get('/orders/confirm/:confirmId', async (req, res, next) => {
  let db = req.db;
  let confirmId = req.params.confirmId;

  try {
    let rs: any = await orderModel.getConfirmItems(db, confirmId);
    res.send({ ok: true, rows: rs[0] });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
});

router.post('/orders/confirm-without-unpaid', async (req, res, next) => {
  let db = req.db;
  try {
    let requisitionId = req.body.requisitionId;
    let items = req.body.items;
    let _items = [];
    let wmProductIds = [];

    let confirm_date = moment().format('YYYY-MM-DD HH:mm:ss');
    let created_at = moment().format('YYYY-MM-DD HH:mm:ss');
    let people_id = req.decoded.people_id;

    let order: any = {};
    order.confirm_date = confirm_date;
    order.requisition_order_id = requisitionId;
    order.people_id = people_id;
    order.created_at = created_at;

    // save order
    let rsConfirm: any = await orderModel.saveConfirm(db, order);
    let confirmId = rsConfirm[0];

    items.forEach(v => {
      _items.push({
        confirm_id: confirmId,
        generic_id: v.generic_id,
        wm_product_id: v.wm_product_id,
        confirm_qty: v.confirm_qty // หน่วยย่อย
      });
    });
    // remove old data
    await orderModel.removeConfirmItems(db, confirmId);
    await orderModel.saveConfirmItems(db, _items);

    res.send({ ok: true });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
});

router.post('/orders/confirm-with-unpaid', async (req, res, next) => {
  let db = req.db;
  try {
    let requisitionId = req.body.requisitionId;
    let items = req.body.items;
    let generics = req.body.generics;
    let _items = [];

    let confirm_date = moment().format('YYYY-MM-DD HH:mm:ss');
    let created_at = moment().format('YYYY-MM-DD HH:mm:ss');
    let people_id = req.decoded.people_id;

    let order: any = {};
    order.confirm_date = confirm_date;
    order.requisition_order_id = requisitionId;
    order.people_id = people_id;
    order.created_at = created_at;
    // order.owner_warehouse_id = req.decoded.warehouseId;

    // save order
    let rsConfirm: any = await orderModel.saveConfirm(db, order);
    let confirmId = rsConfirm[0];
    let desProducts = [];

    items.forEach(v => {
      _items.push({
        confirm_id: confirmId,
        generic_id: v.generic_id,
        wm_product_id: v.wm_product_id,
        confirm_qty: v.confirm_qty // หน่วยย่อย
      });
    });
    // remove old data
    await orderModel.removeConfirmItems(db, confirmId);
    await orderModel.saveConfirmItems(db, _items);

    // save unpaid
    let unpaidOrder: any = {};
    unpaidOrder.unpaid_date = moment().format('YYYY-MM-DD');
    unpaidOrder.requisition_order_id = requisitionId;
    unpaidOrder.people_id = people_id;
    unpaidOrder.created_at = moment().format('YYYY-MM-DD HH:mm:ss')

    let rsOrderUnpaid = await orderModel.saveOrderUnpaid(db, unpaidOrder);
    let orderUnpaidId = rsOrderUnpaid[0];

    let unpaidItems = [];
    generics.forEach(v => {
      let unpaidQty = v.requisition_qty - v.total_confirm_qty;
      if (unpaidQty > 0) {
        let obj: any = {};
        obj.requisition_order_unpaid_id = orderUnpaidId;
        obj.generic_id = v.generic_id;
        obj.unpaid_qty = v.requisition_qty - v.total_confirm_qty;
        unpaidItems.push(obj);
      }
    });
    // save items
    await orderModel.saveOrderUnpaidItems(db, unpaidItems);
    res.send({ ok: true });

  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
});

router.put('/orders/confirm/:confirmId', async (req, res, next) => {
  let db = req.db;
  let confirmId: any = req.params.confirmId;

  try {
    let items = req.body.items;
    let _items = [];

    items.forEach(v => {
      _items.push({
        confirm_id: confirmId,
        generic_id: v.generic_id,
        wm_product_id: v.wm_product_id,
        confirm_qty: v.confirm_qty // หน่วยย่อย
      });
    });
    // remove old data
    await orderModel.removeConfirmItems(db, confirmId);
    await orderModel.saveConfirmItems(db, _items);

    res.send({ ok: true });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
});

// router.delete('/orders/confirm/remove/:confirmId', async (req, res, next) => {
//   let db: any = req.db;
//   let confirmId: any = req.params.confirmId;

//   try {
//     await orderModel.removeConfirmOrder(db, confirmId);
//     res.send({ ok: true });
//   } catch (error) {
//     res.send({ ok: false, error: error.message });
//   } finally {
//     db.destroy();
//   }

// });

router.put('/orders/confirm/approve/:confirmId', async (req, res, next) => {
  let db = req.db;
  let confirmId: any = req.params.confirmId;


  try {
    let peopleId = req.decoded.people_id;
    let approveDate = moment().format('YYYY-MM-DD');
    let isApprove = 'Y';

    let approveData: any = {};
    approveData.is_approve = isApprove;
    approveData.approve_date = approveDate;
    approveData.approve_people_id = peopleId;

    // get confirm detail
    let rs: any = await orderModel.getRequisitionFromConfirm(db, confirmId);

    if (rs.length) {
      if (moment(rs[0].requisition_date).isValid()) {
        let year = moment(rs[0].requisition_date, 'YYYY-MM-DD').get('year');
        let month = moment(rs[0].requisition_date, 'YYYY-MM-DD').get('month') + 1;

        let isClose = await periodModel.isPeriodClose(db, year, month);

        if (isClose) {
          res.send({ ok: false, error: 'บัญชีถูกปิดแล้ว' });
        } else {
          await orderModel.saveApproveConfirmOrder(db, confirmId, approveData);

          // save product to wm_products
          let preReq = await orderModel.getPreRequisitionDetail(db, confirmId);
          let requisitionProducts = await orderModel.getRequisitionConfirmItems(db, confirmId);

          let wmProductIds = []; // สำหรับดึงข้อมูลรายการในคลัง
          let wmProducts = []; // รายการสินค้าใหม่
          let dstProducts = []; // รายการสินค้าสำหรับปรับลดยอด
          let items = []; // รายการสินค้า
          let stockCard = []; // รายการ StockCard
          let requisitionWarehouseId = preReq[0].wm_requisition;
          let withdrawWarehouseId = preReq[0].wm_withdraw;

          requisitionProducts.forEach(v => {

            wmProductIds.push(v.wm_product_id);

            dstProducts.push({
              qty: v.confirm_qty,
              wm_product_id: v.wm_product_id,
              warehouse_id: withdrawWarehouseId
            });

            items.push({
              qty: v.confirm_qty,
              wm_product_id: v.wm_product_id
            });

          });

          let rsWmProducts = await orderModel.getWmProducs(db, wmProductIds);

          // product items
          let products: any = [];

          rsWmProducts.forEach((v: any) => {
            let id = uuid();
            let qty = 0;
            let idx = _.findIndex(items, { wm_product_id: v.wm_product_id });
            if (idx > -1) {
              qty = items[idx].qty;
              let obj: any = {
                wm_product_id: id,
                warehouse_id: requisitionWarehouseId,
                // vendor_labeler_id: v.vendor_labeler_id,
                product_id: v.product_id,
                // generic_id: v.generic_id,
                qty: qty,
                price: v.cost,
                cost: v.cost,
                lot_no: v.lot_no,
                expired_date: moment(v.expired_date, 'YYYY-MM-DD').isValid() ? moment(v.expired_date).format('YYYY-MM-DD') : null,
                unit_generic_id: v.unit_generic_id,
                location_id: +v.location_id,
                people_user_id: req.decoded.people_user_id,
                created_at: moment().format('YYYY-MM-DD HH:mm:ss')
              };
              products.push(obj);
            }
          });

          // create stockcard detail
          let sc: any = await orderModel.getRequisitionOrderItem(db, confirmId);          
          sc[0].forEach(v => {
            let objStockcardOut: any = {}
            let objStockcardIn: any = {}
            objStockcardOut.stock_date = moment().format('YYYY-MM-DD HH:mm:ss');
            objStockcardOut.product_id = v.product_id;
            objStockcardOut.generic_id = v.generic_id;
            objStockcardOut.unit_generic_id = v.unit_generic_id;
            objStockcardOut.transaction_type = 'REQ_OUT';
            objStockcardOut.document_ref_id = v.requisition_order_id;
            objStockcardOut.in_qty = 0;
            objStockcardOut.in_unit_cost = 0;
            objStockcardOut.out_qty = v.confirm_qty;
            objStockcardOut.out_unit_cost = v.cost;
            objStockcardOut.balance_qty = v.src_balance_qty-v.confirm_qty;
            objStockcardOut.balance_unit_cost = v.cost;
            objStockcardOut.ref_src = v.src_warehouse;
            objStockcardOut.ref_dst = v.dst_warehouse;
            objStockcardOut.comment = 'ให้เบิก';
            stockCard.push(objStockcardOut);

            objStockcardIn.stock_date = moment().format('YYYY-MM-DD HH:mm:ss');
            objStockcardIn.product_id = v.product_id;
            objStockcardIn.generic_id = v.generic_id;
            objStockcardIn.unit_generic_id = v.unit_generic_id;
            objStockcardIn.transaction_type = 'REQ_IN';
            objStockcardIn.document_ref_id = v.requisition_order_id;
            objStockcardIn.in_qty = v.confirm_qty;
            objStockcardIn.in_unit_cost = v.cost;
            objStockcardIn.out_qty = 0
            objStockcardIn.out_unit_cost = 0
            objStockcardIn.balance_qty = v.dst_balance_qty+v.confirm_qty;
            objStockcardIn.balance_unit_cost = v.cost;
            objStockcardIn.ref_src = v.dst_warehouse;
            objStockcardIn.ref_dst = v.src_warehouse;
            objStockcardIn.comment = 'เบิก';
            stockCard.push(objStockcardIn);
          })
          console.log('********************************************');
          console.log(stockCard);
          console.log('********************************************');
          
          // save stock card
          await orderModel.saveStockCard(db,stockCard);
          // save true data
          await productModel.saveProducts(db, products);
          await orderModel.decreaseQty(db, dstProducts);

          res.send({ ok: true });
        }
      } else {
        res.send({ok:false,error:'วันที่เบิกไม่ถูกต้อง'});
        // await orderModel.saveApproveConfirmOrder(db, confirmId, approveData);

        // // save product to wm_products
        // let preReq = await orderModel.getPreRequisitionDetail(db, confirmId);
        // let requisitionProducts = await orderModel.getRequisitionConfirmItems(db, confirmId);

        // let wmProductIds = []; // สำหรับดึงข้อมูลรายการในคลัง
        // let wmProducts = []; // รายการสินค้าใหม่
        // let dstProducts = []; // รายการสินค้าสำหรับปรับลดยอด
        // let items = []; // รายการสินค้า
        // let requisitionWarehouseId = preReq[0].wm_requisition;
        // let withdrawWarehouseId = preReq[0].wm_withdraw;

        // requisitionProducts.forEach(v => {

        //   wmProductIds.push(v.wm_product_id);

        //   dstProducts.push({
        //     qty: v.confirm_qty,
        //     wm_product_id: v.wm_product_id,
        //     warehouse_id: withdrawWarehouseId
        //   });

        //   items.push({
        //     qty: v.confirm_qty,
        //     wm_product_id: v.wm_product_id
        //   });

        // });

        // let rsWmProducts = await orderModel.getWmProducs(db, wmProductIds);

        // // product items
        // let products: any = [];

        // rsWmProducts.forEach((v: any) => {
        //   let id = uuid();
        //   let qty = 0;
        //   let idx = _.findIndex(items, { wm_product_id: v.wm_product_id });
        //   if (idx > -1) {
        //     qty = items[idx].qty;
        //     let obj: any = {
        //       wm_product_id: id,
        //       warehouse_id: requisitionWarehouseId,
        //       // vendor_labeler_id: v.vendor_labeler_id,
        //       product_id: v.product_id,
        //       // generic_id: v.generic_id,
        //       qty: qty,
        //       price: v.cost,
        //       cost: v.cost,
        //       lot_no: v.lot_no,
        //       expired_date: moment(v.expired_date, 'YYYY-MM-DD').isValid() ? moment(v.expired_date).format('YYYY-MM-DD') : null,
        //       unit_generic_id: v.unit_generic_id,
        //       // location_id: +v.location_id,
        //       people_user_id: req.decoded.people_user_id,
        //       created_at: moment().format('YYYY-MM-DD HH:mm:ss')
        //     };
        //     products.push(obj);
        //   }
        // });

        // // create stockcard detail

        // // save true data
        // await productModel.saveProducts(db, products);
        // await orderModel.decreaseQty(db, dstProducts);

        // res.send({ ok: true });
      }
    } else {
      res.send({ ok: false, error: 'ไม่พบรายการที่ต้องการอนุมัติ' });
    }

  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
});

// save unpaid
router.post('/unpaid/confirm', async (req, res, next) => {
  let db = req.db;
  let items = req.body.items;
  let unpaidId = req.body.unpaidId;
  let requisitionId = req.body.requisitionId;
  let peopleId = req.decoded.people_id;
  let confirmDate = moment().format('YYYY-MM-DD')

  let objSummary: any = {};
  objSummary.requisition_order_unpaid_id = unpaidId;
  objSummary.people_id = peopleId;
  objSummary.confirm_date = confirmDate;
  objSummary.created_at = moment().format('YYYY-MM-DD HH:mm:ss');

  try {
    let rsSummary: any = await orderModel.saveConfirmUnpaid(db, objSummary);
    let orderUnpaidId = rsSummary[0];

    let _items: any = [];
    items.forEach(v => {
      let obj: any = {
        confirm_unpaid_id: orderUnpaidId,
        confirm_qty: v.confirm_qty,
        generic_id: v.generic_id,
        wm_product_id: v.wm_product_id,
      }

      _items.push(obj);
    });

    // console.log(_items);
    await orderModel.setPaidStatus(db, unpaidId);
    await orderModel.saveConfirmUnpaidItems(db, _items);

    // get product for update 

    let rsUnpaid: any = await orderModel.getUnpaidItemsForImport(db, orderUnpaidId);
    let products = rsUnpaid[0];
    // console.log('=====================')
    // console.log(products);

    let dstProducts = [];
    let wmProducts = [];
    products.forEach(v => {
      dstProducts.push({
        qty: v.confirm_qty,
        wm_product_id: v.wm_product_id,
        warehouse_id: v.wm_withdraw
      });

      let id = uuid();
      let obj: any = {
        wm_product_id: id,
        warehouse_id: v.wm_requisition,
        product_id: v.product_id,
        qty: v.confirm_qty,
        price: v.price,
        cost: v.cost,
        lot_no: v.lot_no,
        expired_date: moment(v.expired_date, 'YYYY-MM-DD').isValid() ? moment(v.expired_date).format('YYYY-MM-DD') : null,
        unit_generic_id: v.unit_generic_id,
        // location_id: +v.location_id,
        people_user_id: req.decoded.people_user_id,
        created_at: moment().format('YYYY-MM-DD HH:mm:ss')
      };

      wmProducts.push(obj);
    });

    // save true data
    await productModel.saveProducts(db, wmProducts);
    await orderModel.decreaseQty(db, dstProducts);

    res.send({ ok: true });
  } catch (error) {
    console.log(error);
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
  /*
  confirm_qty: 5000
  generic_id: "1020010"
  wm_product_id: "2424492345851"
  */

});

router.post('/unpaid/change-unpaid', async (req, res, next) => {
  let db = req.db;
  let requisitionOrderId = req.body.requisitionOrderId;

  try {
    await orderModel.changeToPaids(db, requisitionOrderId);
    res.send({ ok: true });
  } catch (error) {
    console.log(error);
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
});

router.get('/templates/:srcWarehouseId/:dstWarehouseId', async (req, res, next) => {
  let db = req.db;
  let srcWarehouseId = req.params.srcWarehouseId;
  let dstWarehouseId = req.params.dstWarehouseId;

  try {
    let rs: any = await orderModel.getTemplate(db, srcWarehouseId, dstWarehouseId);
    res.send({ ok: true, rows: rs });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
});

router.get('/templates-items/:templateId', async (req, res, next) => {
  let db = req.db;
  let templateId = req.params.templateId;
  console.log(req.params);
  try {
    let rs: any = await orderModel.getTemplateItems(db, templateId);
    res.send({ ok: true, rows: rs[0] });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
});


export default router;