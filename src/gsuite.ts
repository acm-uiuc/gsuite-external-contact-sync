import { google } from "googleapis";
import { GoogleAuth } from "google-auth-library";
import { logger } from "./logging.js";

export interface GoogleContact {
  email: string;
  upn: string;
  givenName: string;
  familyName: string;
  displayName: string;
}

export interface ExistingContact {
  id: string;
  etag: string;
  contact: GoogleContact;
}

/**
 * Creates a Google Auth client with domain-wide delegation
 * For Domain Shared Contacts API
 */
export const createGoogleClient = (
  serviceAccountJson: string,
  delegatedUser: string,
) => {
  const serviceAccountInfo = JSON.parse(serviceAccountJson);

  return new google.auth.GoogleAuth({
    credentials: serviceAccountInfo,
    scopes: ["https://www.google.com/m8/feeds"],
    clientOptions: {
      subject: delegatedUser,
    },
  });
};

/**
 * Gets an access token for the GData API
 */
const getAccessToken = async (auth: GoogleAuth): Promise<string> => {
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();

  if (!tokenResponse.token) {
    throw new Error("Failed to get access token");
  }

  return tokenResponse.token;
};

/**
 * Fetches all domain shared contacts using GData API
 */
export const getAllDomainContacts = async (
  auth: GoogleAuth,
  domain: string,
): Promise<Map<string, ExistingContact>> => {
  logger.info({ domain }, "Fetching domain shared contacts via GData API");
  const contacts = new Map<string, ExistingContact>();

  try {
    const accessToken = await getAccessToken(auth);
    const feedUrl = `https://www.google.com/m8/feeds/contacts/${domain}/full`;

    let startIndex = 1;
    const maxResults = 1000;

    while (true) {
      const url = `${feedUrl}?max-results=${maxResults}&start-index=${startIndex}&alt=json`;

      logger.info({ startIndex, url }, "Fetching contacts page");

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "GData-Version": "3.0",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
            url,
          },
          "Failed to fetch domain contacts",
        );
        throw new Error(
          `Failed to fetch contacts: ${response.statusText} - ${errorText}`,
        );
      }

      const data = (await response.json()) as { feed?: { entry: unknown[] } };
      const entries = data.feed?.entry || [];

      logger.info(
        { entriesInPage: entries.length },
        `Processing page starting at ${startIndex}`,
      );

      if (entries.length === 0) {
        break;
      }

      for (const entry of entries) {
        const contact = parseGDataEntry(entry);
        if (contact) {
          const key = getPrimaryEmail(contact.contact);
          contacts.set(key, contact);
        }
      }

      if (entries.length < maxResults) {
        break;
      }

      startIndex += maxResults;
    }

    logger.info(
      { total: contacts.size },
      "Finished fetching domain shared contacts",
    );
    return contacts;
  } catch (error: any) {
    logger.error({ error: error.message }, "Error fetching domain contacts");
    throw error;
  }
};

/**
 * Creates a new domain shared contact
 */
export const createDomainContact = async (
  auth: GoogleAuth,
  domain: string,
  contact: GoogleContact,
): Promise<boolean> => {
  try {
    const accessToken = await getAccessToken(auth);
    const feedUrl = `https://www.google.com/m8/feeds/contacts/${domain}/full`;
    const atomXml = contactToAtomXml(contact);

    const response = await fetch(feedUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "GData-Version": "3.0",
        "Content-Type": "application/atom+xml",
      },
      body: atomXml,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        {
          status: response.status,
          error: errorText,
          email: getPrimaryEmail(contact),
        },
        "Failed to create contact",
      );
      throw new Error(`Failed to create contact: ${response.statusText}`);
    }

    logger.info(
      { email: getPrimaryEmail(contact) },
      "Created domain shared contact",
    );
    return true;
  } catch (error: any) {
    logger.error(
      {
        error: error.message,
        email: getPrimaryEmail(contact),
      },
      "Error creating domain contact",
    );
    return false;
  }
};

/**
 * Updates an existing domain shared contact
 */
export const updateDomainContact = async (
  auth: GoogleAuth,
  domain: string,
  contactId: string,
  etag: string,
  contact: GoogleContact,
): Promise<boolean> => {
  try {
    const accessToken = await getAccessToken(auth);
    const editUrl = `https://www.google.com/m8/feeds/contacts/${domain}/full/${contactId}`;
    const atomXml = contactToAtomXml(contact);

    const response = await fetch(editUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "GData-Version": "3.0",
        "Content-Type": "application/atom+xml",
        "If-Match": etag,
      },
      body: atomXml,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        {
          status: response.status,
          error: errorText,
          email: getPrimaryEmail(contact),
        },
        "Failed to update contact",
      );
      throw new Error(`Failed to update contact: ${response.statusText}`);
    }

    logger.info(
      { email: getPrimaryEmail(contact) },
      "Updated domain shared contact",
    );
    return true;
  } catch (error: any) {
    logger.error(
      {
        error: error.message,
        email: getPrimaryEmail(contact),
      },
      "Error updating domain contact",
    );
    return false;
  }
};

/**
 * Deletes a domain shared contact
 */
export const deleteDomainContact = async (
  auth: GoogleAuth,
  domain: string,
  contactId: string,
  etag: string,
  email: string,
): Promise<boolean> => {
  try {
    const accessToken = await getAccessToken(auth);
    const editUrl = `https://www.google.com/m8/feeds/contacts/${domain}/full/${contactId}`;

    const response = await fetch(editUrl, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "GData-Version": "3.0",
        "If-Match": etag,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        {
          status: response.status,
          error: errorText,
          email,
        },
        "Failed to delete contact",
      );
      throw new Error(`Failed to delete contact: ${response.statusText}`);
    }

    logger.info({ email }, "Deleted domain shared contact");
    return true;
  } catch (error: any) {
    logger.error(
      {
        error: error.message,
        email,
      },
      "Error deleting domain contact",
    );
    return false;
  }
};

/**
 * Converts contact to Atom XML for GData API
 */
const contactToAtomXml = (contact: GoogleContact): string => {
  const emails: string[] = [];

  if (contact.email) {
    emails.push(
      `    <gd:email rel="http://schemas.google.com/g/2005#work" address="${escapeXml(contact.email)}" primary="true" />`,
    );
  }

  if (
    contact.upn &&
    contact.upn.toLowerCase() !== contact.email.toLowerCase()
  ) {
    emails.push(
      `    <gd:email rel="http://schemas.google.com/g/2005#other" address="${escapeXml(contact.upn)}" />`,
    );
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<atom:entry xmlns:atom="http://www.w3.org/2005/Atom"
            xmlns:gd="http://schemas.google.com/g/2005">
  <atom:category scheme="http://schemas.google.com/g/2005#kind"
                 term="http://schemas.google.com/contact/2008#contact" />
  <gd:name>
    <gd:givenName>${escapeXml(contact.givenName)}</gd:givenName>
    <gd:familyName>${escapeXml(contact.familyName)}</gd:familyName>
    <gd:fullName>${escapeXml(contact.displayName)}</gd:fullName>
  </gd:name>
${emails.join("\n")}
</atom:entry>`;
};

/**
 * Parses a GData entry to our contact format
 */
const parseGDataEntry = (entry: any): ExistingContact | null => {
  const emails = entry.gd$email || [];
  if (emails.length === 0) return null;

  const primaryEmail =
    emails.find((e: any) => e.primary === "true")?.address || emails[0].address;
  const otherEmail =
    emails.find((e: any) => e.rel?.includes("other"))?.address || "";
  const name = entry.gd$name || {};

  // Extract ID from entry ID (format: https://www.google.com/m8/feeds/contacts/{domain}/base/{id})
  const id = entry.id?.$t?.split("/").pop() || "";
  const etag = entry.gd$etag || "*";

  return {
    id,
    etag,
    contact: {
      email: primaryEmail || "",
      upn: otherEmail || "",
      givenName: name.gd$givenName?.$t || "",
      familyName: name.gd$familyName?.$t || "",
      displayName: name.gd$fullName?.$t || primaryEmail || "",
    },
  };
};

/**
 * Gets primary email from contact
 */
const getPrimaryEmail = (contact: GoogleContact): string => {
  return (contact.email || contact.upn).toLowerCase();
};

/**
 * Escapes XML special characters
 */
const escapeXml = (str: string): string => {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};
