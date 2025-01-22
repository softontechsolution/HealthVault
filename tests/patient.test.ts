import { mockReset } from "jest-mock-extended";
import { Request, Response } from "express";
import PatientController from "../src/controllers/PatientController";
import prisma from "./singleton";
import { CustomSessionData } from "../src/types";
import MedRecordController from "../src/controllers/MedRecordController";
import { Role, Sex, BloodGroup } from "@prisma/client";

// Mocking the req object
const mockReq = (): Partial<Request> => ({
  params: {},
  body: {},
  session: {} as CustomSessionData,
});

// Mocking the res object
const mockRes = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res); // Chainable
  res.json = jest.fn().mockReturnValue(res); // Chainable
  return res;
};

beforeEach(() => {
  mockReset(prisma);
});

const mockPatient = {
  id: 1,
  fullName: "John Doe",
  dateOfBirth: new Date("1990-01-01"),
  phone: "1234567890",
  email: "john.doe@example.com",
  address: "123 Main St",
  sex: Sex.MALE, // Use the enum value
  bloodGroup: BloodGroup.A_PLUS, // Use the enum value
  userId: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUser = {
  id: 1,
  name: "Doctor",
  email: "doctor@example.com",
  password: "hashedpassword",
  role: Role.DOCTOR, // Use the enum value
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("PatientController", () => {
  describe("newPatient", () => {
    it("should create a new patient and return 200", async () => {
      const req = mockReq();
      const res = mockRes();
      req.body = {
        fullName: "John Doe",
        dateOfBirth: "1990-01-01",
        phone: "1234567890",
        email: "john.doe@example.com",
        address: "123 Main St",
        sex: "MALE",
        bloodGroup: "A_PLUS",
      };
      req.session = { user: { id: "1" } } as CustomSessionData;

      prisma.patient.create.mockResolvedValue(mockPatient);

      await PatientController.newPatient(req as Request, res as Response);

      expect(prisma.patient.create).toHaveBeenCalledWith({
        data: {
          fullName: "John Doe",
          dateOfBirth: new Date("1990-01-01"),
          phone: "1234567890",
          email: "john.doe@example.com",
          address: "123 Main St",
          sex: "MALE",
          bloodGroup: "A_PLUS",
          userId: 1,
        },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ "Patient data:": mockPatient });
    });

    it("should return 400 if fullName or sex is missing", async () => {
      const req = mockReq();
      req.body = {
        // fullName is missing
        sex: "MALE", // Include sex to avoid triggering the "Sex is required" error
      };

      const res = mockRes();

      await PatientController.newPatient(req as Request, res as Response);

      // Verify the response
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Full name is required" });
    });

    it("should return 500 if an unexpected error occurs", async () => {
      const req = mockReq();
      req.body = {
        fullName: "John Doe",
        sex: "MALE",
      };
      const res = mockRes();
      req.session = { user: { id: "1" } } as CustomSessionData;

      prisma.patient.create.mockRejectedValue(new Error("Unexpected error"));

      await PatientController.newPatient(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Unexpected error" });
    });
  });

  describe("getPatient", () => {
    it("should fetch a patient by id and return 200", async () => {
      const req = mockReq();
      req.params = { id: "1" };

      const mockPatientWithUser = {
        ...mockPatient,
        User: mockUser,
      };

      const res = mockRes();

      prisma.patient.findUnique.mockResolvedValue(mockPatientWithUser);

      await PatientController.getPatient(req as Request, res as Response);

      expect(prisma.patient.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: { User: true },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        patient: {
          ...mockPatientWithUser,
          createdBy: "Doctor",
        },
      });
    });
  });

  describe("getPatients", () => {
    it("should return 500 if an unexpected error occurs", async () => {
      const req = mockReq();
      const res = mockRes();

      prisma.patient.findMany.mockRejectedValue(new Error("Unexpected error"));

      await PatientController.getPatients(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Unexpected error" });
    });
  });

  describe("getLabResults", () => {
    it("should fetch lab results for a patient and return 200", async () => {
      const req = mockReq();
      req.params = { id: "1" };

      const mockLabResults = [
        {
          id: 1,
          testName: "Test A",
          result: "Positive",
          notes: "Lab notes", // This can also be `null` if needed
          patientId: 1,
          userId: 1,
          createdAt: new Date(), // Add the missing required field
          performedAt: new Date(), // Add the missing required field
        },
      ];

      prisma.patient.findUnique.mockResolvedValue(mockPatient);
      prisma.labResult.findMany.mockResolvedValue(mockLabResults);
      const res = mockRes();

      await PatientController.getLabResults(req as Request, res as Response);

      expect(prisma.labResult.findMany).toHaveBeenCalledWith({
        where: { patientId: 1 },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ "Lab Results": mockLabResults });
    });

    it("should return 400 if no id is provided", async () => {
      const req = mockReq();
      const res = mockRes();

      await PatientController.getLabResults(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "No ID provided from getLabResults",
      });
    });

    it("should return 404 if no patient is found", async () => {
      const req = mockReq();
      req.params = { id: "1" };

      const res = mockRes();
      prisma.patient.findUnique.mockResolvedValue(null);

      await PatientController.getLabResults(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "No patient found" });
    });
  });
});
