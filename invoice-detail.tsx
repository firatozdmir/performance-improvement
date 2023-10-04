import React, { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import SelectBox from 'devextreme-react/select-box';
import Form, { ColCountByScreen, Item, RequiredRule, SimpleItem, Tab, TabbedItem, TabPanelOptions } from 'devextreme-react/form';
import TextArea from 'devextreme-react/text-area';
import { NumberBox } from 'devextreme-react';
import notify from 'devextreme/ui/notify';
import { confirm } from 'devextreme/ui/dialog';
import ArrayStore from 'devextreme/data/array_store';
import DataSource from 'devextreme/data/data_source';
import LoadPanel from 'devextreme-react/load-panel';

import InvoiceService from '../../services/invoice-service';
import CustomerService from '../../services/customer-service';
import OrderService from '../../services/order-service';
import warehouseVoucherService from '../../services/warehouse-voucher-service';
import ourProjectService from '../../services/our-project-service';

import { ResponseCodeConst } from '../../consts/response-code-const';
import { invoiceTypeEnum, orderTypeEnum, relatedSubjectTypeEnum,partyPatchKindEnum } from '../../enums/page-type-enum';
import { useCurrencies, useDeductionItems, useVatCutDefinitions, useSupplierCustomers } from '../../hooks/lookup-query';
import { LabelMode } from 'devextreme/common';
import { useNavigate } from 'react-router';
import sharedData from '../shared/component-constants';
import RadioGroup from 'devextreme-react/radio-group';
import { CalculateEngine } from '../../helpers/calculate-engine';
import { UtilHelper } from '../../helpers/util-helper';
import { DateHelper } from '../../helpers/date-helper';
  
const InvoiceDetail = () => {
  const navigate = useNavigate();

  const refForm: any = useRef(null);
  const refPopup: any  = useRef(null);
  const tradeKinds = [{id: 0, name: 'Kati' }, {id: 3, name: 'Hizmet'}];
  const refPaymentComponent: any = useRef(null);
  const refFileAttachmentComponent: any = useRef(null);
  const refVatItems: any = useRef(null);
  const vatItemsForeignCurrencyFormRef:any = useRef(null);
  const divForeignAreaRef:any = useRef(null);
  const vatItemsDataGridRef:any = useRef(null);
  const refInvoiceForm :any= useRef(null);
  const refLoadPanel: any = useRef(null);
  const loadPanelVisibleRef: any = useRef(false);

  const refTaxOfficeForm: any = useRef<any>(null);

  const refInvoiceItemsDataGrid: any = useRef(null);
  const refCustomerSelectBox = useRef<any>(null);
  
  const queryParams = new URLSearchParams(window.location.href.split('?')[1]);
  const type = Number(queryParams.get('type'));
  const returnInvoiceType = Number(queryParams.get('returnInvoiceType'));
  const relatedSubject = Number(queryParams.get('relatedSubject')); //ihracat=3
  const id = Number(queryParams.get('id'));
  const customerId = Number(queryParams.get('customerId'));
  const orderId = Number(queryParams.get('orderId'));
  const warehouseVoucherId = Number(queryParams.get('warehouseVoucherId'));
  const returnInvoiceId = Number(queryParams.get('returnInvoiceId')); //İade faturası - Faturayı iadeye çevirirken faturaId değeri buradan sağlanıyor. Veritabanına gitmiyor.

  const [invoice, setInvoice] = useState<any>(
    {
      invoiceId: id,
      type: type,
      returnInvoiceType: returnInvoiceType,
      relatedSubject: relatedSubject,
      relatedId: 0,
      tradeKind: (relatedSubject === relatedSubjectTypeEnum.IHRACAT_FATURASI) ? 0 : -1,
      refNo: "",
      invoiceNo: "", 
      orderId: orderId,
      date: (id === 0) ? new Date(): null, 
      timeStamp: (id === 0) ? new Date(): null, 
      description: '',
      partyPatchType: 0,
      partyPatchId: customerId !== 0 ? customerId : null,
      paymentPlanId: 0,
      currencyId: 1,
      currencyCode: '',
      exchangeRate: 1,
      vatRate: 0,
      totalAmount: 0,
      discountRate: 0,
      discount: 0,
      itemDiscountTotal: 0,
      itemSurTaxTotal: 0,
      amountDueVat: 0,
      vat: 0,
      totalVatCut: 0,
      deductionId: 0,
      deductionRate: 0,
      deduction: 0,
      netTotal: 0,
      taxIdNo: 0,
      taxOfficeId: 0,
      invoiceAddressId: 0,
      invoiceAddress:"",
      shippingDate: (id === 0) ? new Date(): null,
      averagePaymentDueTime: null,
      averagePaymentDueDate: null,
      surTaxName: 'Ek Vergi',
      surTaxRate: 0
    });
  const [ourProjectList, setOurProjectList] = useState<any>([]);
  const [orders, setOrders] = useState<any>(null);
  const [orderLookupEnabled, setOrderLookupEnabled] = useState<boolean>(returnInvoiceType === -1 && id === 0);
  const [warehouseVoucherLookupEnabled, setWarehouseVoucherLookupEnabled] = useState<boolean>(returnInvoiceType === -1 && id === 0);
  const [supplierCustomer, setSupplierCustomer] = useState<any>(null);
  const [vatItems, setVatItems] = useState<any>([]); /*Alt toplamları hesaplayan api'nin dönüş değerleri*/
  const [vatItemsForeignCurrency, setVatItemsForeignCurrency] = useState<any>({totalAmount: 0, itemDiscountTotal: 0, itemSurTaxTotal: 0, amountDueVat: 0, vat: 0, totalVatCut: 0, deductionId: 0, deductionRate: 0, deduction: 0, netTotal: 0}); /* Alt toplamlar yabancı para cinsindeki karşılıkları */
  const { deductionItems } = useDeductionItems();
  const [selectedDeductionId, setSelectedDeductionId] = useState(0);
  const { currencies } = useCurrencies();
  const { vatCutDefinitions } = useVatCutDefinitions();
  const [labelMode, setLabelMode] = useState<LabelMode>('floating');
  const [loadPanelVisible, setLoadPanelVisible] = useState<boolean>(false);
  const [updateKey, setUpdateKey] = useState(1);
  const [updateKeyVatPopup, setUpdateKeyVatPopup] = useState(3);
  const [selectedRadioButton, setSelectedRadioButton] = useState<number>(type);
  const [addresses,setAddresses] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [supplierCustomers, setSupplierCustomers] = useState<any>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null)

  const PaymentsComponent = React.lazy(() => import('../shared/payments'));
  const InvoiceDetailLineGridComponent = React.lazy(() => import('./invoice-detail-line-grid2'));
  const InvoiceDetailToolbarComponent = React.lazy(() => import('./invoice-detail-toolbar'));
  const FileAttachmentComponent = React.lazy(() => import('../shared/file-attachment-component'));
  const SupplierCustomerInfoPopupComponent = React.lazy(() => import('../shared/supplier-customer-popup'));
  const InvoiceDetailPopupVatItemsComponent = React.lazy(() => import('./invoice-detail-popup-vat-items'));

  const priorities = ['Tedarikçi','Müşteri'];

  const getInvoiceBottomFormInstance = () => {
    return refInvoiceForm.current.instance;
  }

  const getVatItemsForeignCurrencyFormInstance = () => {
    return vatItemsForeignCurrencyFormRef.current.instance;
  }

  const getInvoiceFormInstance = () => {
    return refForm.current.instance;
  }

  const getCustomerSelectBoxInstance = () => {
    return refCustomerSelectBox.current.instance;
  }

  useEffect(()=> {
      if (invoice.invoiceId !== 0 || customerId !== 0 || orderId !== 0 || warehouseVoucherId !== 0 || (returnInvoiceId !== 0 && invoice.returnInvoiceType === 0))
        showLoadPanel();

      setTimeout(() => {
        if(invoice.invoiceId !== 0)
          fillFields(invoice.invoiceId);
        else if(customerId !== 0)
          fillCustomerFields(customerId);        
        else if(orderId !== 0)
          fillOrderFields(invoice.orderId);
        else if(warehouseVoucherId !== 0)
          fillWarehouseVoucherFields(warehouseVoucherId);
        else if(returnInvoiceId !== 0 && invoice.returnInvoiceType === 0) //iade faturası
          fillFieldsByReturnInvoiceId(returnInvoiceId);
      }, 100);

      // const warehouseVouchers: any = warehouseVoucherService.getWarehouseVoucherLookupByPartyPatch(invoice.type === invoiceTypeEnum.satisFaturasi ? orderTypeEnum.satisSiparisi : orderTypeEnum.satinalmaSiparisi, invoice.partyPatchId);
      // const [supplierCustomers,orders,warehouseVouchers,ourProjects] =  //TODO: Promise.All denenecek
      setTimeout(() => {
        let ourProjects: any = ourProjectService.getOurProjects();
        ourProjects.load().done((data:any)=>{
          setOurProjectList(data);
        })

        const supplierCustomers: any = CustomerService.getSupplierCustomerLookup(partyPatchKindEnum.MUSTERI);
        setSupplierCustomers({
          paginate: true,
          pageSize: 5,
          store: supplierCustomers,
          filter:['kind', '=', selectedRadioButton] 
        })
        
        const orders: any = OrderService.getOrderLookupByPartyPatch(invoice.type === invoiceTypeEnum.satisFaturasi ? orderTypeEnum.satisSiparisi : orderTypeEnum.satinalmaSiparisi, invoice.partyPatchId);
        setOrders({
          paginate: true,
          pageSize: 20,
          store: orders
        })
        
        calculateGrandTotal();
        getInvoiceBottomFormInstance().repaint();
        hideLoadPanel();
      }, 2000);
      
      
      // return () => {
      //   clearLog();
      //     console.log("Cleared log.")
      // }
  }, [])

  const fillFields = (invoiceId: number) => {
    InvoiceService.getInvoice(invoiceId).then((data: any) => {
      setAddresses(data.addresses);
      setSelectedCustomerId(data.detail.partyPatchId)

        let address = data.addresses.find(x => x.partyAddressId === data.detail.deliveryAddressId)
        setSelectedAddress(address);
      

      const invoiceDate = new Date(data.detail.date);
      const averagePaymentDueDate = (UtilHelper.isNotEmpty(data.detail.averagePaymentDueDate)) 
                                    ? new Date(invoiceDate.setHours(invoiceDate.getHours() + data.detail.averagePaymentDueTime * 24))
                                    : null;
      const averagePaymentDueTime = (UtilHelper.isNotEmpty(data.detail.averagePaymentDueTime))
                                    ? data.detail.averagePaymentDueTime
                                    : null
      setInvoice(prevState =>({
        ...prevState,
        ...data.detail,
        averagePaymentDueDate: averagePaymentDueDate,
        averagePaymentDueTime: averagePaymentDueTime
      }));
      // let initializeSupplierCustomer = {
      //   partyPatchId: data.supplierCustomer.partyPatchId,
      //   text: data.supplierCustomer.title,
      //   kind: data.supplierCustomer.kind
      // }
      // getCustomerSelectBoxInstance().option("defaultValue",initializeSupplierCustomer);

      // getCustomerSelectBoxInstance().option("value",initializeSupplierCustomer);
      // getCustomerSelectBoxInstance().repaint();
        setSupplierCustomer(data.supplierCustomer);
        setSelectedRadioButton(data.supplierCustomer.kind);
        setSelectedDeductionId(data.detail.deductionId)
      
        setUpdateKey(2);
        calculateGrandTotalByParams(data.detail, data.items, data.supplierCustomer, vatItems);
      
    })
  }

  const fillCustomerFields = useCallback(async (customerId: number) => {
    CustomerService.getSupplierCustomer(customerId,'2').then((data :any) => {
      setInvoice(prevState => ({
        ...prevState,
        partyPatchId: customerId,
        invoiceAddress: UtilHelper.isNotEmpty(data.detail.invoiceAddress) ? data.detail.invoiceAddress : ""
      }))
      setSupplierCustomer(data.detail);
      
      setAddresses(data.addresses);
      setSelectedAddress(data.addresses[0]);
      setSelectedRadioButton(data.detail.kind);
    })
  },[customerId]);

  const fillOrderFields = async (orderId: number) => {
    OrderService.getOrder(orderId).then((data: any) => {
      data.detail.id = 0; // Siparişten fatura oluştururken id alanları çakışıyor.
      data.items.forEach(function(item: any) {
        item.itemNo += 1;
        item.invoiceItemId = 0;
        item.quantity = (warehouseVoucherId !== 0)?item.undeliveredQuantity : item.uninvoicedQuantity ;
      });
      setInvoice(prevState => ({
        ...prevState,
        ...data.detail,
        invoiceId: 0,
        id: 0,
        date: new Date(),
        timeStamp: new Date(),
        averagePaymentDueDate: (data.detail.averagePaymentDueTime !== null &&data.detail.averagePaymentDueTime !== undefined) 
                                ? new Date(new Date(invoice.date).setHours(new Date(invoice.date).getHours() + data.detail.averagePaymentDueTime * 24))
                                : null,
        averagePaymentDueTime: (data.detail.averagePaymentDueTime !== null &&data.detail.averagePaymentDueTime !== undefined)
                                ? data.detail.averagePaymentDueTime
                                : null,
        invoiceAddress: UtilHelper.isNotEmpty(data.supplierCustomer.invoiceAddress) ? data.supplierCustomer.invoiceAddress.address : ""
      }))
      setSupplierCustomer(data.supplierCustomer)
      
      calculateGrandTotalByParams(data.detail, data.items, data.supplierCustomer, vatItems);
    })
    getInvoiceBottomFormInstance().repaint();
  }

  const fillFieldsByReturnInvoiceId = async (invoiceId: number) => {
    InvoiceService.getInvoice(invoiceId).then((data: any) => {
      data.detail.id = 0;
      data.detail.date = new Date();
      data.detail.timeStamp = new Date();
      
      data.items.forEach(function(item: any) {
        item.itemNo +=1
        item.returnedItemId = item.invoiceItemId;
        item.invoiceItemId = 0;
        item.itemId = 0;
        item.invoiceId = 0;
        item.quantity = item.netQuantity;
      });

      setInvoice(prevState => ({
        ...prevState,
        ...data.detail,
        invoiceId: 0, 
        invoiceNo: '',
        date: new Date(),
        timeStamp: new Date(),
        returnInvoiceType: 0,
        averagePaymentDueDate: (invoice.averagePaymentDueTime !== null && invoice.averagePaymentDueTime !== undefined) 
                                ? new Date(new Date(invoice.shippingDate).setHours(new Date(invoice.date).getHours() + invoice.averagePaymentDueTime * 24))
                                : null,
        averagePaymentDueTime:(data.detail.averagePaymentDueTime !== null &&data.detail.averagePaymentDueTime !== undefined)
                                ? data.detail.averagePaymentDueTime
                                : null
      }));
      setSupplierCustomer(data.supplierCustomer)
      setSelectedDeductionId(data.detail.deductionId)

      calculateGrandTotalByParams(data.detail, data.items, data.supplierCustomer, vatItems);
    })
    
  }

  const fillWarehouseVoucherFields = async (warehouseVoucherId: number) => {
    warehouseVoucherService.getWarehouseVoucher(warehouseVoucherId).then((data: any) => {
      data.detail.id = 0; // İrsaliyeden fatura oluştururken id alanları çakışıyor.
      data.items.forEach(async function(item: any) {
        let product:any = await InvoiceService.getCommercialProduct(item.productId, invoice.type === invoiceTypeEnum.satisFaturasi ? partyPatchKindEnum.SATILAN_URUN : partyPatchKindEnum.ALINAN_URUN);
        item.itemNo += 1;
        item.invoiceItemId= 0;
        item.amount = 0;
        item.discountRate = 0;
        item.discountShare = 0;
        item.discount = 0;
        item.surTaxRate = 0;
        item.surTax = 0;
        item.vatRate = product.vatRate;
        item.vatCutDefinitionId = 0;
        item.vatCutNominator = 0;
        item.vatCutDenominator = 0;
        item.quantity = item.uninvoicedQuantity
      });

      setInvoice(prevState => ({
        ...prevState,
        ...data.detail,
        invoiceId: 0,
        id: 0,
        date: new Date(),
        timeStamp: new Date(),
        averagePaymentDueDate: (data.detail.averagePaymentDueTime !== null && data.detail.averagePaymentDueTime !== undefined) 
                                ? new Date(new Date(invoice.date).setHours(new Date(invoice.date).getHours() + data.detail.averagePaymentDueTime * 24))
                                : null,
        averagePaymentDueTime:(data.detail.averagePaymentDueTime !== null && data.detail.averagePaymentDueTime !== undefined)
                                ? data.detail.averagePaymentDueTime
                                : null
      }));
      setSupplierCustomer(data.supplierCustomer);

      calculateGrandTotalByParams(data.detail, data.items, data.supplierCustomer, vatItems);

    })
  }

  const setInvoiceFormField = (data:any) =>{
    if(!data){
      return;
    }
    getInvoiceBottomFormInstance().updateData("totalAmount",data.totalAmount);
    getInvoiceBottomFormInstance().updateData("itemDiscountTotal",data.itemDiscountTotal);
    getInvoiceBottomFormInstance().updateData("itemSurTaxTotal",data.itemSurTaxTotal);
    getInvoiceBottomFormInstance().updateData("amountDueVat",data.amountDueVat);
    getInvoiceBottomFormInstance().updateData("vat",data.vat);
    getInvoiceBottomFormInstance().updateData("totalVatCut",data.totalVatCut);
    getInvoiceBottomFormInstance().updateData("deductionId",data.deductionId);
    getInvoiceBottomFormInstance().updateData("deductionRate",data.deductionRate);
    getInvoiceBottomFormInstance().updateData("deduction",data.deduction);
    getInvoiceBottomFormInstance().updateData("netTotal",data.netTotal);
    // getInvoiceBottomFormInstance().option("formData",data);
    // getInvoiceFormInstance().option("formData",data);
    getInvoiceBottomFormInstance().repaint();
  }

  const calculateGrandTotal = () => {
    var invoiceItems:any = getInvoiceItems();
    let response:any = CalculateEngine.ExecuteTradeComputeEngine(invoice, invoiceItems, supplierCustomer, vatItems,vatCutDefinitions)
    setInvoiceFormField(response.detail);
    // setInvoice(response.detail);
    // setVatItems(response.data.vatItems)

    refVatItems.current && refVatItems.current.setVatGridDataSource(response.vatItems);
    vatItemsDataGridRef.current && vatItemsDataGridRef.current.instance.refresh();
    
    if (invoice.currencyId > 0)
      calculateGrandTotalForeignCurrency(response.detailItems);
  }

  const calculateGrandTotalByParams = (invoice: any, invoiceItems: any, supplierCustomer: any, vatItems) => {
    let response:any = CalculateEngine.ExecuteTradeComputeEngine(invoice, invoiceItems, supplierCustomer, vatItems,vatCutDefinitions)
    setInvoiceFormField(response.detail);
    // setInvoice(response.detail);

    refVatItems.current && refVatItems.current.setVatGridDataSource(response.vatItems);
    // setVatItems(response.vatItems);
    // setVatItems(response.vatItems);
    vatItemsDataGridRef.current && vatItemsDataGridRef.current.instance.refresh();

    if (invoice.currencyId > 0)
      calculateGrandTotalForeignCurrency(response.detail);
  }

  const calculateGrandTotalForeignCurrency = (invoiceData:any) => {
    getVatItemsForeignCurrencyFormInstance().updateData("totalAmount",invoice.totalAmount / invoice.exchangeRate);
    getVatItemsForeignCurrencyFormInstance().updateData("itemDiscountTotal",invoice.itemDiscountTotal / invoice.exchangeRate);
    getVatItemsForeignCurrencyFormInstance().updateData("itemSurTaxTotal",invoice.itemSurTaxTotal / invoice.exchangeRate);
    getVatItemsForeignCurrencyFormInstance().updateData("deductionRate",invoice.deductionRate / invoice.exchangeRate);

    getVatItemsForeignCurrencyFormInstance().updateData("amountDueVat",invoice.amountDueVat / invoice.exchangeRate);
    getVatItemsForeignCurrencyFormInstance().updateData("vat",invoice.vat / invoice.exchangeRate);
    getVatItemsForeignCurrencyFormInstance().updateData("totalVatCut",invoice.totalVatCut / invoice.exchangeRate);
    getVatItemsForeignCurrencyFormInstance().updateData("deduction",invoice.deduction / invoice.exchangeRate);
    getVatItemsForeignCurrencyFormInstance().updateData("netTotal",invoice.netTotal / invoice.exchangeRate);
  }

  const onShowingVatItemsPopup = () => {
    vatItemsDataGridRef.current.instance.refresh();
  }

  const renderTax = (data) => {
    return (<div onClick={()=> refVatItems.current.onPopupShow()}><NumberBox value={invoice.vat} stylingMode='outlined' format='###,##0.00 TL' readOnly={true} /></div>)
  }

  const getInvoiceLineGridInstance = () => {
  
    if(!refInvoiceItemsDataGrid.current){
      return null;
    }
    return refInvoiceItemsDataGrid.current.instance;
  }

  const checkValidateForms = ():boolean =>{

    let validData = refTaxOfficeForm.current.instance.validate();
    if(validData.isValid){
      return true;
    }
    
    validData.brokenRules[0].validator.focus();
    return false;
  }

  const onSaveButtonClick = async(e: any) => {
    if (!checkValidateForms())
      return;

    showLoadPanel();
    refLoadPanel.current.instance.show();
    if(loadPanelVisibleRef.current){
      return;
    }

    loadPanelVisibleRef.current = true;

    const invoiceData = {
      ...invoice, 
      partyPatchId: supplierCustomer.partyPatchId, 
      partyPatchType: supplierCustomer.kind,
      invoiceAddressId: selectedAddress.partyAddressId
    }
    getInvoiceLineGridInstance() && getInvoiceLineGridInstance().saveEditData();

    var invoiceItems:any = getInvoiceItems();
    let calculateResponse:any = CalculateEngine.ExecuteTradeComputeEngine(invoiceData, invoiceItems, supplierCustomer, vatItems,vatCutDefinitions)
    // setVatItems(calculateResponse.vatItems);
    calculateGrandTotalByParams(invoiceData, invoiceItems, null, calculateResponse.vatItems);
    
    InvoiceService.saveInvoice(invoiceData, invoiceItems, supplierCustomer, calculateResponse.vatItems).then((response:any) => {

        if (response.code === ResponseCodeConst.Success) {
          response.success.forEach(function(message: any) {
            notify(message, "success", 3000);
          });
          response.data.items.forEach(function(item: any) { item.itemNo +=1 });
          setInvoice(prevState => ({
            ...prevState,
            ...response.data.detail,
          }));
          getInvoiceBottomFormInstance().repaint();
          setUpdateKey(5)
          getInvoiceLineGridInstance() && getInvoiceLineGridInstance().saveEditData();
        }
        else {
          loadPanelVisibleRef.current = false;
          hideLoadPanel();
          refLoadPanel.current.instance.hide();


          response.errors.forEach(function(message: any) {
            notify(message, "error", 3000);
            console.error("saveError:", message);
          });
        }
        loadPanelVisibleRef.current = false;
        hideLoadPanel();
        refLoadPanel.current.instance.hide();
      })
  }

  const onDeleteButtonClick = (e: any) => {
    let res:any = confirm("Faturayı silmek istediğinize emin misiniz?:", "Uyarı");
    new Promise((resolve, reject) => {
      res.done(async (dialogResult: boolean) => {
        if (dialogResult) {
          const response: any = await InvoiceService.deleteInvoice(invoice.invoiceId);
          if (response.code === ResponseCodeConst.Success) {
            response.success.forEach(function(message: any) {
                notify(message, "success", 3000);
            });
            navigate('/invoices?type=' + invoice.type + '&returnInvoiceType=' + invoice.returnInvoiceType + '&relatedSubject=' + invoice.relatedSubject)
          }
          else {
            response.errors.forEach(function(message: any) {
                notify(message, "error", 3000);
                console.error("deleteError:", message);
            });
          }
        }
      });
    })
  }


  const warehouseVoucherDataSource = {
    
          paginate: true,
          pageSize: 20,
          store: warehouseVoucherService.getWarehouseVoucherLookupByPartyPatch(invoice.type === invoiceTypeEnum.satisFaturasi ? orderTypeEnum.satisSiparisi : orderTypeEnum.satinalmaSiparisi, invoice.partyPatchId)
  }
  

  const onPartyPatchChanged = async(e: any) => {
    if(UtilHelper.isNotEmpty(e.previousValue) && (e.previousValue === e.value)){ return;}
    if(e.value !== undefined && e.value !== null) { 
      setSelectedCustomerId(e.value)
      console.log("bakalım: ", e)
      let data:any = await CustomerService.getSupplierCustomer(e.value,'5');
      console.log('getSupplierCustomer: ', data)
      setSupplierCustomer(data.detail);
      setAddresses(data.addresses);
      let address:any = data.addresses.find(x => x.partyAddressId === data.detail.invoiceAddressId)
      setSelectedAddress(address);

      // setTimeout(() => {
      //   let address:any = data.addresses.find(x => x.partyAddressId === invoice.invoiceAddressId)
      //   if(address){ 
      //     setSelectedAddress(address);
      //     setInvoice(prevState => ({
      //       ...prevState,
      //       partyPatchId: data.detail.partyPatchId,
      //       partyPatchType: data.detail.kind,
      //       invoiceAddressId: address.partyAddressId
      //     }));
      //   }
      //   else{
      //     setSelectedAddress(data.addresses[0]);
      //     setInvoice(prevState => ({
      //       ...prevState,
      //       partyPatchId: data.detail.partyPatchId,
      //       partyPatchType: data.detail.kind,
      //       invoiceAddressId:(data.addreses &&data.addreses.length>0 ) ? data.addresses[0].partyAddressId:0
      //     }));
      //   }
      // }, 0);
      
      setTimeout(() => {
        const orders: any = OrderService.getOrderLookupByPartyPatch(invoice.type === invoiceTypeEnum.satisFaturasi ? orderTypeEnum.satisSiparisi : orderTypeEnum.satinalmaSiparisi, e.value.partyPatchId);
        setOrders({
          paginate: true,
          pageSize: 20,
          store: orders
        })
      }, 0);
    }
    else{
      if(UtilHelper.isNotEmpty(e.previousValue)){
        getCustomerSelectBoxInstance().option('value',e.previousValue)
      }
    }
  }

  const onInvoiceTabFormFieldDataChanged = (e: any) => {
    let isChangedDateFields: boolean = false;
    let invoiceData = invoice;
    if(e.dataField === "averagePaymentDueTime"){
      if(!UtilHelper.isNotEmpty(invoiceData.averagePaymentDueTime)) {
        invoiceData.averagePaymentDueTime = null;
        invoiceData.averagePaymentDueDate = null;
      }
      else{
        const date = DateHelper.getDate(invoiceData.shippingDate)
        invoiceData.averagePaymentDueDate = new Date(date.setHours(date.getHours() + e.value * 24))
      }
      isChangedDateFields = true;
    }
    else if(e.dataField === "averagePaymentDueDate"){
      if(invoiceData.averagePaymentDueDate === null || invoiceData.averagePaymentDueDate === undefined) {
        invoiceData.averagePaymentDueTime = null;
        invoiceData.averagePaymentDueDate = null;
      }
      else{
        let date1: any = DateHelper.getDate(invoiceData.averagePaymentDueDate);
        let date2: any = DateHelper.getDate(invoiceData.shippingDate);
        const diffInMs = date1 - date2;
        invoiceData.averagePaymentDueTime = Math.ceil(diffInMs / (1000 * 60 * 60 * 24))
      }
      isChangedDateFields = true;
    }
    else if(e.dataField === "exchangeRate"){
      calculateGrandTotalForeignCurrency(invoice);
    }
    if(isChangedDateFields) {
      getInvoiceFormInstance().updateData("averagePaymentDueDate", invoiceData.averagePaymentDueDate);
      getInvoiceFormInstance().updateData("averagePaymentDueTime", invoiceData.averagePaymentDueTime);
    }
  }

  const onDeductionChanged = (e: any) => {
    let invoiceData = invoice;
    if (selectedDeductionId === e.value) {
      return;
    }

    if(e.value){
      deductionItems.forEach((item: any) => {
        if (item.deductionItemId === e.value) {
          invoiceData.deductionRate = item.rate
          setSelectedDeductionId(e.value);
          getVatItemsForeignCurrencyFormInstance().updateData("deductionId",e.value);
        }
      });
    }
    else{
      getInvoiceBottomFormInstance().updateData("deductionRate",0);
      invoiceData.deductionRate = 0;
      setSelectedDeductionId(0);
      getVatItemsForeignCurrencyFormInstance().updateData("deductionId",0);
  
    }
    let deductionRateItem = getInvoiceBottomFormInstance().getEditor("deductionRate");
      deductionRateItem.option("readOnly",selectedDeductionId === 0);
    var invoiceItems:any = getInvoiceItems();
    calculateGrandTotalByParams(invoiceData, invoiceItems, supplierCustomer, vatItems);
  }

  const onDeductionRateChanged = (e:any) => {
    if(e.value >= 0){
      getInvoiceBottomFormInstance().updateData("deductionRate",e.value);
      calculateGrandTotal();
    }
  }

  const onOrderNoChanged = (e: any) => {
    showLoadPanel();
    fillOrderFields(e.value)
  }

  const onWarehouseVoucherNoChanged = (e: any) => {
    showLoadPanel();
    fillWarehouseVoucherFields(e.value)
  }

  const onCurrencyCodeChanged = (e: any) => {    
    currencies.forEach((item: any) => {
      if (item.currencyId === e.value) {
        if(e.value === 1) {
          getInvoiceFormInstance().updateData("exchangeRate", 1);
        }
        getInvoiceFormInstance().updateData("currencyCode", item.code);
        
        return;
      }
    });
    const editor = getInvoiceFormInstance().getEditor("exchangeRate");
    editor.option("readOnly",invoice.currencyId === 1);
    divForeignAreaRef.current.style.display = invoice.currencyId === 1 ? 'none':'block';
    
    const formattedDataFields = ["totalAmount","itemDiscountTotal","amountDueVat","vat","totalVatCut","netTotal","itemSurTaxTotal"];
    (invoice.currencyId !== 1 && formattedDataFields.forEach((item:any) => {
      const vatItemsForeignCurrencyEditor = getVatItemsForeignCurrencyFormInstance().getEditor(item);
      vatItemsForeignCurrencyEditor && vatItemsForeignCurrencyEditor.option("format",'###,##0.00 ' + invoice.currencyCode);
    }))
    calculateGrandTotalForeignCurrency(null);
  }

  const onOurProjectsChanged = (e: any) => {
    if(e.value === null){
      getInvoiceFormInstance().updateData("relatedId", 0);
      getInvoiceFormInstance().updateData("relatedSubject",-1);
      return ;
    }

  ourProjectList.forEach((item: any) => {
    if (item.partyPatchId === e.value) {
      getInvoiceFormInstance().updateData("relatedId", item.partyPatchId);
      getInvoiceFormInstance().updateData("relatedSubject", 6);
    }
  });
  }

  const onDescriptionChanged = (e: any) => {
    setInvoice(prevState =>({
      ...prevState,
      description:e.value
    }));
  }

  const getInvoiceItems = () => {
    let invoiceLineGridVisibleRows = getInvoiceLineGridInstance() ? getInvoiceLineGridInstance().getVisibleRows():[];
    let invoiceItems:any = [];
    
    for (let i = 0; i < invoiceLineGridVisibleRows.length; i++) {
      const item = invoiceLineGridVisibleRows[i].data;
      invoiceItems[i] = item;
    }

    return invoiceItems;
  }
  
  const onValueChangedRadioButton = (e:any) => {
    let selectedButton = e.value === "Tedarikçi" ? 0:1;
    setSelectedRadioButton(selectedButton);
    if((supplierCustomer && (supplierCustomer!.kind === selectedButton))) 
    {
      return;
    };
    // setSupplierCustomers({
    //   ...supplierCustomers,
    //   filter:['kind', '=', selectedButton] 
    // });
    if(supplierCustomer != null){
      setSupplierCustomer(null);
      getCustomerSelectBoxInstance().option("value",null);

      setSupplierCustomer(null);
      setAddresses([]);
      setSelectedAddress(null);
    }
  }

  const onLabelModeChanged = (e: any) => {
    setLabelMode(e.value)
  }

  const getAddresses = () =>{
    return {
      paginate:true,
      pageSize: 5,
      store : new ArrayStore({
        key:  "partyAddressId",
        data: addresses,
      }),
    }
  }

  const showFileAttachmentPopup = (e:any)=>{
    refFileAttachmentComponent.current.showAttachmentPopup();
  }

  const showSupplierCustomerInfoPopup = (e:any) => {
    refPopup.current.instance.show();
  }

  const showLoadPanel = () => {
    setLoadPanelVisible(true);
  }

  const onAddressTypeChanged = (e:any) =>{
    if(UtilHelper.isNotEmpty(e.value)){
      setSelectedAddress(e.value);
    }
  } 

  const hideLoadPanel = () => {
    setLoadPanelVisible(false);
  }

  const supplierCustomersDataSource = {
      paginate:true,
      pageSize: 5,
      store: CustomerService.getSupplierCustomerLookup(selectedRadioButton),
      key:'PartyPatchId'
  }

  const getTitleTypeByPageType = () =>{
    return selectedRadioButton === 0 ? "Tedarikçi":"Müşteri"
  }

  return ( 
    <React.Fragment>
      <div className='aqv-page-toolbar'>
        <Suspense fallback={<div>Loading...</div>}>
          <InvoiceDetailToolbarComponent key = {updateKey} 
              type={invoice.type}
              invoiceId={invoice.invoiceId}
              relatedSubject={invoice.relatedSubject}
              returnInvoiceType={invoice.returnInvoiceType}
              netTotal={invoice.netTotal}
              refPaymentComponent = {refPaymentComponent} 
              refFileAttachmentComponent = {refFileAttachmentComponent}
              onSaveButtonClick = {onSaveButtonClick}
              onDeleteButtonClick = {onDeleteButtonClick} />
        </Suspense>
      </div>
      <div className={'page-content'}>
        <div className={'dx-card responsive-paddings'}>
          <div className='row' style={{width:'100%'}}>
            <div id="form-demo" className='col-md-6' style={{width:'40%', position: 'relative', float: 'left', marginTop:'10px'}}>
              <p className='dx-tab-text' style={{color: '#0fd355', marginBottom:"10px"}}>
                {getTitleTypeByPageType()} Bilgileri
              </p>
              <div className='col-md-10'>
                <RadioGroup items = {priorities} 
                value = {priorities[selectedRadioButton]} 
                defaultValue = {priorities[type]}  
                layout="horizontal"  onValueChanged = {
                  onValueChangedRadioButton}/>

                <SelectBox
                  ref = {refCustomerSelectBox}
                  value={selectedCustomerId}
                  displayExpr="text"
                  valueExpr="partyPatchId"
                  dataSource={supplierCustomers}
                  labelMode={labelMode}
                  stylingMode={'outlined'}
                  acceptCustomValue={true}
                  label={getTitleTypeByPageType()}
                  searchEnabled={true}
                  noDataText={`${getTitleTypeByPageType()} Bulunamadı`}
                  placeholder={""}
                  onValueChanged={onPartyPatchChanged}
                  buttons={[{location:'after',name:'addCustomer',options:{
                    stylingMode:'text', icon: (supplierCustomer) ?'edit':'plus',
                    onClick :showSupplierCustomerInfoPopup
                  }}]}
                />
                <Form
                  ref = {refTaxOfficeForm}
                  labelMode={labelMode} labelLocation={'left'}
                  formData={supplierCustomer}
                  colCount={2} minColWidth={300}>
                    <Item dataField="taxOfficeName" label={{text:'Vergi Dairesi'}} editorOptions={{stylingMode:'outlined'}}>
                      <RequiredRule message={sharedData.validationMessage} />
                    </Item>
                    <Item dataField="taxIdNo" label={{text:'VKN / TCKN'}} editorOptions={{stylingMode:'outlined'}} />
                </Form>

                <SelectBox
                  dataSource = { getAddresses() } displayExpr = "addressType" 
                  value = { selectedAddress} 
                  labelMode={labelMode} stylingMode={'outlined'} 
                  label={"Fatura Adresi"} 
                  onValueChanged = {onAddressTypeChanged}
                />

                <Form
                  labelMode={labelMode} labelLocation={'left'}
                  formData={UtilHelper.isNotEmpty(supplierCustomer)?supplierCustomer.invoiceAddress:{}}
                  colCount={3} minColWidth={300}>
                    <Item dataField="address" editorType="dxTextArea" colSpan={3} label={{text:'Adres'}} editorOptions={{stylingMode:'outlined'}} />
                    <Item dataField="country" label={{text:'Ülke'}} editorOptions={{stylingMode:'outlined'}} />
                    <Item dataField="city" label={{text:'İl'}} editorOptions={{stylingMode:'outlined'}} />
                    <Item dataField="town" label={{text:'İlçe'}} editorOptions={{stylingMode:'outlined'}} />
                </Form>
              </div>
            </div>

            <div className='col-md-6' style={{width:'50%', position: 'relative', float: 'right', marginTop:'2px'}}>
              <Form
                  formData = {invoice}
                  onFieldDataChanged = {onInvoiceTabFormFieldDataChanged}
                  labelMode = {labelMode} 
                  labelLocation = {'left'} 
                  showColonAfterLabel = {true}                    
                  width = {"auto"} 
                  minColWidth = {295}
                  ref = {refForm}>
                    <TabbedItem tabPanelOptions={{height: '237px'}}>
                    <TabPanelOptions deferRendering={false}/>
                      {((invoice.relatedSubject === relatedSubjectTypeEnum.YOK) || (invoice.relatedSubject ===relatedSubjectTypeEnum.PROJEMIZ)) && generalTabContent()}
                      {invoice.relatedSubject === relatedSubjectTypeEnum.IHRACAT_FATURASI && generalTabContentForTradeKind()}
                      <Tab title="Sipariş">
                        <ColCountByScreen xs={1} sm={2} md={2} lg={2} />
                        <SimpleItem colSpan={2} dataField="orderId" editorType="dxSelectBox" label={{text:'Sipariş No'}}
                            editorOptions={{ stylingMode:'outlined',
                                dataSource: orders, displayExpr: 'text', valueExpr: 'orderId', searchEnabled: true, disabled: !orderLookupEnabled, onValueChanged: onOrderNoChanged
                            }} />
                      </Tab>
                      <Tab title="Sevkiyat">
                        <ColCountByScreen xs={1} sm={2} md={2} lg={2} />
                        <SimpleItem colSpan={2} dataField="warehouseVoucherId" editorType="dxSelectBox" label={{text:'İrsaliye No'}}
                            editorOptions={{ stylingMode:'outlined',
                                dataSource: warehouseVoucherDataSource, displayExpr: 'text', valueExpr: 'warehouseVoucherId', searchEnabled: true, disabled: !warehouseVoucherLookupEnabled, onValueChanged: onWarehouseVoucherNoChanged
                            }} />
                      </Tab>
                      <Tab title="Ödeme"></Tab>
                      <Tab title="Diğer"></Tab>
                    </TabbedItem>
                </Form>
            </div>
          </div>
          <div style={{position: 'relative', float: 'left'}}>
            <Suspense fallback={<div>Loading...</div>}>
              <InvoiceDetailLineGridComponent
                refDataGrid={refInvoiceItemsDataGrid}
                isLoading={loadPanelVisible}
                type={invoice.type}
                currencyId={invoice.currencyId}
                exchangeRate={invoice.exchangeRate}
                currencyCode={invoice.currencyCode}
                surTaxName={invoice.surTaxName} 
                invoiceId={id} 
                calculateGrandTotal={calculateGrandTotal} 
                 />
            </Suspense>
          </div>
          <div>
            <div style={{width:'40%', position: 'relative', float: 'left', marginTop: '15px'}}>
              <TextArea
                label={"Açıklama"} stylingMode='outlined' labelMode={labelMode}
                height={75} maxLength={1000}
                value={invoice.description}
                onValueChanged = {onDescriptionChanged}
                  />
            </div>
            <div ref={divForeignAreaRef} style={{position: 'relative', float:'right', width: 200, display: (invoice.currencyId === 1) ? 'none' : 'block'}}>
              <Form
                labelMode={'hidden'} labelLocation={'left'}
                formData={vatItemsForeignCurrency}
                colCount={1} minColWidth={300}
                ref = {vatItemsForeignCurrencyFormRef}>
                  <Item dataField="totalAmount" label={{text:'Toplam Tutar'}} editorOptions={{stylingMode:'outlined', format:'###,##0.00 ' + invoice.currencyCode, readOnly:'true'}} />
                  <Item dataField="itemDiscountTotal" label={{text:'Satır İndirimleri Toplamı'}} editorOptions={{stylingMode:'outlined', format:'###,##0.00 ' + invoice.currencyCode, readOnly:'true'}} />
                  <Item dataField="itemSurTaxTotal" label={{text:invoice.surTaxName}} editorOptions={{stylingMode:'outlined', format:'###,##0.00 ' + invoice.currencyCode, readOnly:'true'}} />
                  <Item dataField="amountDueVat" label={{text:'KDV Öncesi Toplam'}} editorOptions={{stylingMode:'outlined', format:'###,##0.00 ' + invoice.currencyCode, readOnly:'true'}} />
                  <Item dataField="vat" label={{text:'KDV'}} editorOptions={{stylingMode:'outlined', format:'###,##0.00 ' + invoice.currencyCode, readOnly:'true'}} />
                  <Item dataField="totalVatCut" label={{text:'KDV Tevkifat Toplamı'}} editorOptions={{stylingMode:'outlined', format:'###,##0.00 ' + invoice.currencyCode, readOnly: true}} />
                  <Item dataField="deductionId" editorType="dxSelectBox" label={{text:'Kesinti Tanımı'}}
                            editorOptions={{ stylingMode:'outlined',  showClearButton: true,
                            placeholder:sharedData.selectBoxPlaceHolder,
                                dataSource: deductionItems, displayExpr: 'name', valueExpr: 'deductionItemId', searchEnabled: true, onValueChanged: onDeductionChanged, readOnly: true
                            }} />
                  <Item dataField="deductionRate" label={{text:'Kesinti Oranı %'}} editorOptions={{stylingMode:'outlined', format:'#0.00', readOnly: true}} />
                  <Item dataField="deduction" label={{text:'Kesinti'}} editorOptions={{stylingMode:'outlined', format:'###,##0.00 ' + invoice.currencyCode, readOnly:'true'}} />
                  <Item dataField="netTotal" label={{text:'Net Toplam'}} editorOptions={{stylingMode:'outlined', format:'###,##0.00 ' + invoice.currencyCode, readOnly:'true'}} />
              </Form>
            </div>
            <div style={{position: 'relative', float:'right', marginRight: 5, width: 350}}>
              <Form
                ref = {refInvoiceForm}
                labelMode={'outside'} labelLocation={'left'}
                formData={invoice}
                colCount={1} minColWidth={300}>
                  <Item dataField="totalAmount" label={{text:'Toplam Tutar'}} editorOptions={{stylingMode:'outlined', format:'###,##0.00 TL', readOnly:'true'}} />
                  <Item dataField="itemDiscountTotal" label={{text:'Satır İndirimleri Toplamı'}} editorOptions={{stylingMode:'outlined', format:'###,##0.00 TL', readOnly:'true'}} />
                  <Item dataField="itemSurTaxTotal" label={{text:invoice.surTaxName}} editorOptions={{stylingMode:'outlined', format:'###,##0.00 TL', readOnly:'true'}} />
                  <Item dataField="amountDueVat" label={{text:'KDV Öncesi Toplam'}} editorOptions={{stylingMode:'outlined', format:'###,##0.00 TL', readOnly:'true'}} />
                  <Item dataField="vat" render={renderTax} label={{text:'KDV'}} editorOptions={{stylingMode:'outlined', format:'###,##0.00 TL', readOnly:'true'}} />
                  <Item dataField="totalVatCut" label={{text:'KDV Tevkifat Toplamı'}} editorOptions={{stylingMode:'outlined', format:'###,##0.00 TL', readOnly:'true'}} />
                  <Item dataField="deductionId" editorType="dxSelectBox" label={{text:'Kesinti Tanımı'}}
                            editorOptions={{ stylingMode:'outlined', showClearButton: true,
                            placeholder:sharedData.selectBoxPlaceHolder,
                                dataSource: deductionItems, displayExpr: 'name', valueExpr: 'deductionItemId', searchEnabled: true, onValueChanged: onDeductionChanged
                            }} />
                  <Item dataField="deductionRate" label={{text:'Kesinti Oranı %'}} editorOptions = {{stylingMode:'outlined', format:'#0.00',
                  readOnly : selectedDeductionId === 0, onValueChanged: onDeductionRateChanged}} />
                  <Item dataField="deduction" label={{text:'Kesinti'}} editorOptions={{stylingMode:'outlined', format:'###,##0.00 TL', readOnly:'true',}} />
                  <Item dataField="netTotal" label={{text:'Net Toplam'}} editorOptions={{stylingMode:'outlined', format:'###,##0.00 TL', readOnly:'true'}} />
              </Form>
            </div>
          </div>
        </div>
        <div className={'dx-card responsive-paddings'} style={{marginTop:"20px"}}>
          <p style={{fontSize: 15, fontWeight: 500, marginTop: 0, marginBottom: 5, marginLeft: 5}}>İlişkili İşlemler</p>
          <Suspense fallback={<div>Loading...</div>}>
            <PaymentsComponent key={updateKey} ref={refPaymentComponent} parentPage={"invoice"} partyPatchId={supplierCustomer?supplierCustomer.partyPatchId : 0} paymentCenterId={0} invoiceId ={invoice.invoiceId} />
          </Suspense>
        </div>
      </div>
      <Suspense fallback={<div>Loading...</div>}>
        <InvoiceDetailPopupVatItemsComponent key={updateKeyVatPopup} ref={refVatItems} dataList={vatItems} refDataGrid={vatItemsDataGridRef} onShowing={onShowingVatItemsPopup} />
        <FileAttachmentComponent key={updateKey} ref={refFileAttachmentComponent} ownerId={invoice.invoiceId} ownerType={3}/>
        <SupplierCustomerInfoPopupComponent popupRef={refPopup} supplierCustomerData={supplierCustomer} address = {selectedAddress} title={getTitleTypeByPageType()} type = {type} updateRefreshData={fillCustomerFields} addressAreaTitle = {sharedData.invoiceAddress}/>
      </Suspense>
      <LoadPanel
        ref = {refLoadPanel}
        position={'center'} shadingColor = "rgba(0,0,0,0.4)"
        onHiding={hideLoadPanel} onShowing={showLoadPanel}
        visible={loadPanelVisible}
        showIndicator={true} shading={true} showPane={true}
      />
    </React.Fragment>
  );

  function generalTabContent() {
    return (
      <Tab title="Genel">
        <ColCountByScreen xs={1} sm={2} md={2} lg={2} />
        <SimpleItem dataField="invoiceNo" colSpan={1} label={{text:'Fatura No'}} editorOptions={{stylingMode:'outlined'}} />
        <SimpleItem dataField="timeStamp" editorType={"dxDateBox"} label={{text:'Fatura Tarihi'}} editorOptions={{stylingMode:'outlined', type:"datetime", displayFormat: 'dd.MM.yyyy HH:mm', useMaskBehavior: true}} />
        <SimpleItem dataField="relatedId" editorType="dxSelectBox" label={{text:'Projemiz'}}
            editorOptions={{ stylingMode:'outlined',
                dataSource: ourProjectList  , displayExpr: 'title', valueExpr: 'partyPatchId', searchEnabled: true, showClearButton: true, onValueChanged: onOurProjectsChanged
            }} />

        <SimpleItem dataField="currencyId" editorType="dxSelectBox" label={{text:'Para Birimi'}}
            editorOptions={{ stylingMode:'outlined',
                dataSource: currencies, displayExpr: 'code', valueExpr: 'currencyId', searchEnabled: true, onValueChanged: onCurrencyCodeChanged
            }} />
        <SimpleItem dataField="shippingDate" editorType={"dxDateBox"}  label={{text:'Sevk Tarihi'}} editorOptions={{stylingMode:'outlined', type:"date", displayFormat: 'dd.MM.yyyy', useMaskBehavior: true, showClearButton: true}} />
        <SimpleItem colSpan={3} dataField="exchangeRate" label={{text:'Kur'}} editorType={"dxNumberBox"} editorOptions={{stylingMode:'outlined', format:'###,##0.00', readOnly: (invoice.currencyId === 1)}} />
        <SimpleItem dataField="averagePaymentDueDate" editorType={"dxDateBox"}  label={{text:'Ödeme Vadesi (Tarih)'}} editorOptions={{stylingMode:'outlined', type:"date", displayFormat: 'dd.MM.yyyy', useMaskBehavior: true, showClearButton: true}} />
        <SimpleItem dataField="averagePaymentDueTime" editorType={"dxNumberBox"} label={{text:'Ödeme Vadesi (Gün)'}} editorOptions={{stylingMode:'outlined',showClearButton: true}} />
      </Tab>
    )
  }

  function generalTabContentForTradeKind() {
    return (
      <Tab title="Genel">
        <ColCountByScreen xs={1} sm={2} md={2} lg={2} />
        <SimpleItem dataField="invoiceNo" colSpan={1} label={{text:'Fatura No'}} editorOptions={{stylingMode:'outlined'}} />
        <SimpleItem dataField="timeStamp" editorType={"dxDateBox"} label={{text:'Fatura Tarihi'}} editorOptions={{stylingMode:'outlined', type:"datetime", displayFormat: 'dd.MM.yyyy HH:mm', useMaskBehavior: true}} />
        <Item dataField="tradeKind" label={{text:'Ticaret Türü'}} editorType="dxSelectBox"
          editorOptions={{ stylingMode:'outlined',
            dataSource: tradeKinds, displayExpr: 'name', valueExpr: 'id', searchEnabled: true
        }} />
        <SimpleItem dataField="shippingDate" editorType={"dxDateBox"}  label={{text:'Sevk Tarihi'}} editorOptions={{stylingMode:'outlined', type:"date", displayFormat: 'dd.MM.yyyy', useMaskBehavior: true, showClearButton: true}} />
        <SimpleItem dataField="currencyId" editorType="dxSelectBox" label={{text:'Para Birimi'}}
            editorOptions={{ stylingMode:'outlined',
                dataSource: currencies, displayExpr: 'code', valueExpr: 'currencyId', searchEnabled: true, onValueChanged: onCurrencyCodeChanged
            }} />
        <SimpleItem dataField="averagePaymentDueDate" editorType={"dxDateBox"}  label={{text:'Ödeme Vadesi (Tarih)'}} editorOptions={{stylingMode:'outlined', type:"date", displayFormat: 'dd.MM.yyyy', useMaskBehavior: true, showClearButton: true}} />
        <SimpleItem colSpan={3} dataField="exchangeRate" label={{text:'Kur'}} editorType={"dxNumberBox"} editorOptions={{stylingMode:'outlined', format:'###,##0.00', readOnly: (invoice.currencyId === 1)}} />
        <SimpleItem dataField="averagePaymentDueTime" editorType={"dxNumberBox"} label={{text:'Ödeme Vadesi (Gün)'}} editorOptions={{stylingMode:'outlined',showClearButton: true}} />
      </Tab>
    )
  }
} 

export default InvoiceDetail;
