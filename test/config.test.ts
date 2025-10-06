import { describe, it, expect, beforeEach, vi } from "vitest";
import { getConfig, getSecrets } from "../src/config";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

vi.mock("@aws-sdk/client-secrets-manager");

describe("config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RunEnvironment = "dev";
  });

  describe("getSecrets", () => {
    it("should return parsed secrets from Secrets Manager", async () => {
      const mockSecrets = {
        entraTenantId: "tenant-123",
        entraClientId: "client-456",
        entraClientCertificate: "cert-base64",
        googleDelegatedUser: "admin@example.com",
        googleServiceAccountJson: '{"type":"service_account"}',
        deleteRemovedContacts: true,
      };

      const mockSend = vi.fn().mockResolvedValue({
        SecretString: JSON.stringify(mockSecrets),
      });

      vi.mocked(SecretsManagerClient).mockImplementation(
        () =>
          ({
            send: mockSend,
          }) as any,
      );

      const result = await getSecrets();

      expect(result).toEqual(mockSecrets);
      expect(mockSend).toHaveBeenCalledWith(expect.any(GetSecretValueCommand));
    });

    it("should return null if SecretString is empty", async () => {
      const mockSend = vi.fn().mockResolvedValue({});

      vi.mocked(SecretsManagerClient).mockImplementation(
        () =>
          ({
            send: mockSend,
          }) as any,
      );

      const result = await getSecrets();

      expect(result).toBeNull();
    });

    it("should return null if JSON parsing fails", async () => {
      const mockSend = vi.fn().mockResolvedValue({
        SecretString: "invalid-json",
      });

      vi.mocked(SecretsManagerClient).mockImplementation(
        () =>
          ({
            send: mockSend,
          }) as any,
      );

      const result = await getSecrets();

      expect(result).toBeNull();
    });
  });

  describe("getConfig", () => {
    it("should return valid configuration", async () => {
      const mockSecrets = {
        entraTenantId: "tenant-123",
        entraClientId: "client-456",
        entraClientCertificate: "cert-base64",
        googleDelegatedUser: "admin@example.com",
        googleServiceAccountJson: '{"type":"service_account"}',
        deleteRemovedContacts: true,
      };

      const mockSend = vi.fn().mockResolvedValue({
        SecretString: JSON.stringify(mockSecrets),
      });

      vi.mocked(SecretsManagerClient).mockImplementation(
        () =>
          ({
            send: mockSend,
          }) as any,
      );

      const result = await getConfig();

      expect(result).toEqual({
        ...mockSecrets,
        environment: "dev",
      });
    });

    it("should throw error if secrets cannot be loaded", async () => {
      const mockSend = vi.fn().mockResolvedValue({});

      vi.mocked(SecretsManagerClient).mockImplementation(
        () =>
          ({
            send: mockSend,
          }) as any,
      );

      await expect(getConfig()).rejects.toThrow("Failed to load configuration");
    });

    it("should validate environment is dev or prod", async () => {
      process.env.RunEnvironment = "invalid";

      const mockSecrets = {
        entraTenantId: "tenant-123",
        entraClientId: "client-456",
        entraClientCertificate: "cert-base64",
        googleDelegatedUser: "admin@example.com",
        googleServiceAccountJson: '{"type":"service_account"}',
        deleteRemovedContacts: true,
      };

      const mockSend = vi.fn().mockResolvedValue({
        SecretString: JSON.stringify(mockSecrets),
      });

      vi.mocked(SecretsManagerClient).mockImplementation(
        () =>
          ({
            send: mockSend,
          }) as any,
      );

      await expect(getConfig()).rejects.toThrow();
    });

    it("should validate required fields", async () => {
      const mockSecrets = {
        entraTenantId: "",
        entraClientId: "client-456",
        entraClientCertificate: "cert-base64",
        googleDelegatedUser: "admin@example.com",
        googleServiceAccountJson: '{"type":"service_account"}',
      };

      const mockSend = vi.fn().mockResolvedValue({
        SecretString: JSON.stringify(mockSecrets),
      });

      vi.mocked(SecretsManagerClient).mockImplementation(
        () =>
          ({
            send: mockSend,
          }) as any,
      );

      await expect(getConfig()).rejects.toThrow();
    });

    it("should default deleteRemovedContacts to true", async () => {
      const mockSecrets = {
        entraTenantId: "tenant-123",
        entraClientId: "client-456",
        entraClientCertificate: "cert-base64",
        googleDelegatedUser: "admin@example.com",
        googleServiceAccountJson: '{"type":"service_account"}',
      };

      const mockSend = vi.fn().mockResolvedValue({
        SecretString: JSON.stringify(mockSecrets),
      });

      vi.mocked(SecretsManagerClient).mockImplementation(
        () =>
          ({
            send: mockSend,
          }) as any,
      );

      const result = await getConfig();

      expect(result.deleteRemovedContacts).toBe(true);
    });
  });
});
