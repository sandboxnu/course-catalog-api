import URI from "urijs";
import macros from "../../utils/macros";

// http://stackoverflow.com/questions/4009756/how-to-count-string-occurrence-in-string/7924240#7924240
export function occurrences(
  string: string,
  subString: string,
  allowOverlapping: boolean
) {
  string += "";
  subString += "";
  if (subString.length <= 0) {
    return string.length + 1;
  }

  let n = 0;
  let pos = 0;
  const step = allowOverlapping ? 1 : subString.length;

  while (pos >= 0) {
    pos = string.indexOf(subString, pos);
    if (pos >= 0) {
      ++n;
      pos += step;
    } else {
      break;
    }
  }
  return n;
}

export function parseNameWithSpaces(name: string): {
  firstName: string;
  lastName: string;
} {
  // Standardize spaces.
  name = name.trim().replace(/\s+/gi, " ");

  // Generate first name and last name
  const spaceCount = occurrences(name, " ", false);
  const splitName = name.split(" ");

  if (spaceCount === 0) {
    macros.warn("0 spaces found in name", name);
    return null;
  }

  // Handles firstName, lastName and firstName, middleName, lastName

  if (spaceCount > 2) {
    macros.log(
      `${name} has more than 1 space in their name. Using first and last word.`
    );
  }

  const obj = {
    firstName: splitName[0],
    lastName: splitName[splitName.length - 1],
  };

  return obj;
}

// Standardizes email addresses found across different pages
// Removes a 'mailto:' from the beginning
// Ensures the email contains a @
export function standardizeEmail(email: string) {
  if (!email) {
    return null;
  }

  if (email.startsWith("mailto:")) {
    email = email.slice("mailto:".length);
  }

  if (!email.includes("@") || email.includes(" ")) {
    return null;
  }

  if (email.endsWith("@neu.edu")) {
    email = `${email.split("@")[0]}@northeastern.edu`;
  }

  return email.toLowerCase().trim();
}

export function standardizePhone(phone: string) {
  if (!phone) {
    return null;
  }

  phone = phone.trim();

  if (phone.startsWith("tel:")) {
    phone = phone.slice("tel:".length).trim();
  }

  let digitsOnly = phone.replace(/[^0-9]/gi, "");

  if (phone.startsWith("+1") && digitsOnly.length === 11) {
    digitsOnly = digitsOnly.slice(1);
  }

  if (digitsOnly.length !== 10) {
    return null;
  }

  return digitsOnly;
}

// Parses the google scholar id from a link that should contain a google scholar link.
// Get the Google Scholar ID with this: https://scholar.google.com/citations?user=[id here]
export function parseGoogleScolarLink(link: string) {
  if (!link) {
    return null;
  }

  const userId = new URI(link).query(true).user;
  if (!userId && link) {
    macros.log("Error parsing google url", link);
    return null;
  }
  return userId;
}

// Gets the base hostname from a url.
// fafjl.google.com -> google.com
// subdomain.bob.co -> bob.co
// bob.co -> bob.co
// This could be improved by using public lists of top-level domains.
export function getBaseHost(url: string) {
  const homepage = new URI(url).hostname();
  if (!homepage || homepage === "") {
    macros.error("could not find homepage of", url);
    return null;
  }

  const match = homepage.match(/[^.]+\.[^.]+$/i);
  if (!match) {
    macros.error("homepage match failed...", homepage);
    return null;
  }
  return match[0];
}
