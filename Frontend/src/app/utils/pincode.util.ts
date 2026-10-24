export interface PincodeDeliveryInfo {
  pincode: string;
  location: string;
  deliveryDate: string;
  shippingType: string;
  codAvailable: boolean;
  deliverable: boolean;
}

const PINCODE_STORAGE_KEY = 'zodiac_delivery_pincode';

/**
 * Checks an Indian postal pincode and returns simulated delivery estimate,
 * city/state coverage, and COD availability for e-commerce product pages.
 */
export function checkDeliveryPincode(pincode: string): PincodeDeliveryInfo | null {
  const cleanPin = (pincode || '').trim();
  if (!/^\d{6}$/.test(cleanPin)) {
    return null;
  }

  let location = 'India';
  let daysToAdd = 6;

  const prefix2 = cleanPin.substring(0, 2);
  const prefix3 = cleanPin.substring(0, 3);
  const prefix4 = cleanPin.substring(0, 4);

  // Exact Major City Lookups
  if (prefix4 === '3800' || prefix3 === '382') {
    location = 'Ahmedabad, Gujarat';
    daysToAdd = 5;
  } else if (prefix4 === '3950') {
    location = 'Surat, Gujarat';
    daysToAdd = 5;
  } else if (prefix4 === '3900') {
    location = 'Vadodara, Gujarat';
    daysToAdd = 5;
  } else if (prefix4 === '3600') {
    location = 'Rajkot, Gujarat';
    daysToAdd = 5;
  } else if (prefix2 === '11') {
    location = 'New Delhi, Delhi NCR';
    daysToAdd = 5;
  } else if (prefix4 === '1220' || prefix4 === '1210') {
    location = 'Gurugram / Faridabad, NCR';
    daysToAdd = 5;
  } else if (prefix4 === '2013' || prefix4 === '2010') {
    location = 'Noida / Ghaziabad, NCR';
    daysToAdd = 5;
  } else if (prefix3 === '400') {
    location = 'Mumbai, Maharashtra';
    daysToAdd = 5;
  } else if (prefix3 === '411') {
    location = 'Pune, Maharashtra';
    daysToAdd = 5;
  } else if (prefix3 === '560') {
    location = 'Bengaluru, Karnataka';
    daysToAdd = 5;
  } else if (prefix3 === '600') {
    location = 'Chennai, Tamil Nadu';
    daysToAdd = 6;
  } else if (prefix3 === '500') {
    location = 'Hyderabad, Telangana';
    daysToAdd = 5;
  } else if (prefix3 === '700') {
    location = 'Kolkata, West Bengal';
    daysToAdd = 6;
  } else if (prefix3 === '302') {
    location = 'Jaipur, Rajasthan';
    daysToAdd = 5;
  } else if (prefix3 === '226') {
    location = 'Lucknow, Uttar Pradesh';
    daysToAdd = 6;
  } else if (prefix3 === '452') {
    location = 'Indore, Madhya Pradesh';
    daysToAdd = 6;
  } else if (prefix3 === '682') {
    location = 'Kochi, Kerala';
    daysToAdd = 6;
  } else if (prefix3 === '160') {
    location = 'Chandigarh';
    daysToAdd = 5;
  } else {
    // Regional State Breakdown
    switch (prefix2) {
      case '12':
      case '13':
        location = 'Haryana';
        daysToAdd = 6;
        break;
      case '14':
      case '15':
      case '16':
        location = 'Punjab';
        daysToAdd = 6;
        break;
      case '17':
        location = 'Himachal Pradesh';
        daysToAdd = 7;
        break;
      case '18':
      case '19':
        location = 'Jammu & Kashmir';
        daysToAdd = 8;
        break;
      case '20':
      case '21':
      case '22':
      case '23':
      case '24':
      case '25':
      case '26':
      case '27':
      case '28':
        location = 'Uttar Pradesh & Uttarakhand';
        daysToAdd = 6;
        break;
      case '30':
      case '31':
      case '32':
      case '33':
      case '34':
        location = 'Rajasthan';
        daysToAdd = 6;
        break;
      case '36':
      case '37':
      case '38':
      case '39':
        location = 'Gujarat';
        daysToAdd = 5;
        break;
      case '40':
      case '41':
      case '42':
      case '43':
      case '44':
        location = 'Maharashtra & Goa';
        daysToAdd = 6;
        break;
      case '45':
      case '46':
      case '47':
      case '48':
      case '49':
        location = 'Madhya Pradesh & Chhattisgarh';
        daysToAdd = 6;
        break;
      case '50':
      case '51':
      case '52':
      case '53':
        location = 'Andhra Pradesh & Telangana';
        daysToAdd = 6;
        break;
      case '56':
      case '57':
      case '58':
      case '59':
        location = 'Karnataka';
        daysToAdd = 6;
        break;
      case '60':
      case '61':
      case '62':
      case '63':
      case '64':
        location = 'Tamil Nadu';
        daysToAdd = 6;
        break;
      case '67':
      case '68':
      case '69':
        location = 'Kerala';
        daysToAdd = 7;
        break;
      case '70':
      case '71':
      case '72':
      case '73':
      case '74':
        location = 'West Bengal & Sikkim';
        daysToAdd = 7;
        break;
      case '75':
      case '76':
      case '77':
        location = 'Odisha';
        daysToAdd = 7;
        break;
      case '78':
      case '79':
        location = 'North East India';
        daysToAdd = 8;
        break;
      case '80':
      case '81':
      case '82':
      case '83':
      case '84':
      case '85':
        location = 'Bihar & Jharkhand';
        daysToAdd = 7;
        break;
      default:
        location = 'All India Coverage';
        daysToAdd = 6;
    }
  }

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + daysToAdd);

  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  };
  const deliveryDate = targetDate.toLocaleDateString('en-US', options);

  return {
    pincode: cleanPin,
    location,
    deliveryDate,
    shippingType: daysToAdd <= 5 ? 'Free Express Shipping' : 'Standard Insured Delivery',
    codAvailable: true,
    deliverable: true
  };
}

export function getSavedPincode(): string {
  try {
    return localStorage.getItem(PINCODE_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function savePincode(pincode: string): void {
  try {
    localStorage.setItem(PINCODE_STORAGE_KEY, pincode);
  } catch {
    // Ignore storage failure
  }
}
