import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createEntraClient,
  getAllEntraUsers,
  getPrimaryEmail,
} from "../src/entra";
import { Client } from "@microsoft/microsoft-graph-client";
import { ClientCertificateCredential } from "@azure/identity";

vi.mock("@microsoft/microsoft-graph-client");
vi.mock("@azure/identity");

describe("entra", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createEntraClient", () => {
    it("should create a Microsoft Graph client with certificate credentials", () => {
      const mockInitWithMiddleware = vi.fn();
      vi.mocked(Client.initWithMiddleware).mockReturnValue({} as any);

      const tenantId = "tenant-123";
      const clientId = "client-456";
      const certificate = Buffer.from("cert-content").toString("base64");

      createEntraClient(tenantId, clientId, certificate);

      expect(ClientCertificateCredential).toHaveBeenCalledWith(
        tenantId,
        clientId,
        { certificate: "cert-content" },
      );

      expect(Client.initWithMiddleware).toHaveBeenCalled();
    });
  });

  describe("getAllEntraUsers", () => {
    it("should fetch all enabled users from Entra ID", async () => {
      const mockUsers = [
        {
          userPrincipalName: "john@example.com",
          mail: "john@example.com",
          givenName: "John",
          surname: "Doe",
          displayName: "John Doe",
        },
        {
          userPrincipalName: "jane@example.com",
          mail: "jane@example.com",
          givenName: "Jane",
          surname: "Smith",
          displayName: "Jane Smith",
        },
      ];

      const mockGet = vi.fn().mockResolvedValue({
        value: mockUsers,
      });

      const mockClient = {
        api: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          filter: vi.fn().mockReturnThis(),
          top: vi.fn().mockReturnThis(),
          get: mockGet,
        }),
      } as any;

      const result = await getAllEntraUsers(mockClient);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        email: "john@example.com",
        upn: "john@example.com",
        givenName: "John",
        familyName: "Doe",
        displayName: "John Doe",
      });
    });

    it("should handle pagination", async () => {
      const mockUsersPage1 = [
        {
          userPrincipalName: "john@example.com",
          mail: "john@example.com",
          givenName: "John",
          surname: "Doe",
          displayName: "John Doe",
        },
      ];

      const mockUsersPage2 = [
        {
          userPrincipalName: "jane@example.com",
          mail: "jane@example.com",
          givenName: "Jane",
          surname: "Smith",
          displayName: "Jane Smith",
        },
      ];

      const mockGetPage1 = vi.fn().mockResolvedValue({
        value: mockUsersPage1,
        "@odata.nextLink": "https://graph.microsoft.com/v1.0/users?$skip=1",
      });

      const mockGetPage2 = vi.fn().mockResolvedValue({
        value: mockUsersPage2,
      });

      const mockClient = {
        api: vi
          .fn()
          .mockReturnValueOnce({
            select: vi.fn().mockReturnThis(),
            filter: vi.fn().mockReturnThis(),
            top: vi.fn().mockReturnThis(),
            get: mockGetPage1,
          })
          .mockReturnValueOnce({
            get: mockGetPage2,
          }),
      } as any;

      const result = await getAllEntraUsers(mockClient);

      expect(result).toHaveLength(2);
    });

    it("should skip users without email or UPN", async () => {
      const mockUsers = [
        {
          givenName: "John",
          surname: "Doe",
          displayName: "John Doe",
        },
        {
          userPrincipalName: "jane@example.com",
          mail: "jane@example.com",
          givenName: "Jane",
          surname: "Smith",
          displayName: "Jane Smith",
        },
      ];

      const mockGet = vi.fn().mockResolvedValue({
        value: mockUsers,
      });

      const mockClient = {
        api: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          filter: vi.fn().mockReturnThis(),
          top: vi.fn().mockReturnThis(),
          get: mockGet,
        }),
      } as any;

      const result = await getAllEntraUsers(mockClient);

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe("jane@example.com");
    });

    it("should parse display name when given/surname are missing", async () => {
      const mockUsers = [
        {
          userPrincipalName: "john@example.com",
          mail: "john@example.com",
          displayName: "John Doe",
        },
      ];

      const mockGet = vi.fn().mockResolvedValue({
        value: mockUsers,
      });

      const mockClient = {
        api: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          filter: vi.fn().mockReturnThis(),
          top: vi.fn().mockReturnThis(),
          get: mockGet,
        }),
      } as any;

      const result = await getAllEntraUsers(mockClient);

      expect(result[0].givenName).toBe("John");
      expect(result[0].familyName).toBe("Doe");
    });

    it("should use mail field if UPN is missing", async () => {
      const mockUsers = [
        {
          mail: "john@example.com",
          givenName: "John",
          surname: "Doe",
          displayName: "John Doe",
        },
      ];

      const mockGet = vi.fn().mockResolvedValue({
        value: mockUsers,
      });

      const mockClient = {
        api: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          filter: vi.fn().mockReturnThis(),
          top: vi.fn().mockReturnThis(),
          get: mockGet,
        }),
      } as any;

      const result = await getAllEntraUsers(mockClient);

      expect(result[0].email).toBe("john@example.com");
      expect(result[0].upn).toBe("");
    });

    it("should handle API errors", async () => {
      const mockGet = vi.fn().mockRejectedValue(new Error("API Error"));

      const mockClient = {
        api: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          filter: vi.fn().mockReturnThis(),
          top: vi.fn().mockReturnThis(),
          get: mockGet,
        }),
      } as any;

      await expect(getAllEntraUsers(mockClient)).rejects.toThrow("API Error");
    });
  });

  describe("getPrimaryEmail", () => {
    it("should return email if present", () => {
      const user = {
        email: "john@example.com",
        upn: "john@corp.example.com",
        givenName: "John",
        familyName: "Doe",
        displayName: "John Doe",
      };

      const result = getPrimaryEmail(user);

      expect(result).toBe("john@example.com");
    });

    it("should return UPN if email is empty", () => {
      const user = {
        email: "",
        upn: "john@corp.example.com",
        givenName: "John",
        familyName: "Doe",
        displayName: "John Doe",
      };

      const result = getPrimaryEmail(user);

      expect(result).toBe("john@corp.example.com");
    });

    it("should return lowercase email", () => {
      const user = {
        email: "John@Example.COM",
        upn: "john@corp.example.com",
        givenName: "John",
        familyName: "Doe",
        displayName: "John Doe",
      };

      const result = getPrimaryEmail(user);

      expect(result).toBe("john@example.com");
    });
  });
});
