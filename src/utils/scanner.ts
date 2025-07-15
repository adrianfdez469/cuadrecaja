import {IProcessedData} from "@/types/IProcessedData";

export function formatName(name: string) {
  const words = name.split(' ');
  const formattedWords = words.map(function (word) {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
  return formattedWords.join(' ');
}

function isIdentityQr(qrText: string) {
  return qrText.includes('N:') && qrText.includes('A:') && qrText.includes('CI:') && qrText.includes('FV:');
}

export function processClientDataFromQR(bruteData: string): IProcessedData {
  try {
    // Custom QR credentials
    if (!isIdentityQr(bruteData)) {
      return {
        code: bruteData.trim(),
        type: 'credential'
      };
      // QR with identity information
    } else {
      // fix the input string to one line and then split by ":" character
      const dirtyUserDataArray = bruteData
          .replace(/[\n\r]/g, '') // clean all the new lines
          .trim() // clean all the start and end white spaces
          .split(':'); // split the information by ":" character
      return {
        name: formatName(dirtyUserDataArray[1].slice(0, -1)),
        lastName: formatName(dirtyUserDataArray[2].slice(0, -2)),
        ci: dirtyUserDataArray[3].slice(0, -2),
        type: 'identity'
      };
    }
  } catch (e) {
    const messageError = 'QR con formato incorrecto';
    console.error(messageError, e);
    throw new Error(messageError);
  }
}