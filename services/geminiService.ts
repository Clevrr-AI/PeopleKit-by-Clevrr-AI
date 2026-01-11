import { GoogleGenAI } from "@google/genai";
import { PayrollEntry, Employee, Department } from "../types";

// Helper to calculate average retention bonus safely
const calculateAvgRetention = (payroll: PayrollEntry[]) => {
  if (payroll.length === 0) return 0;
  const total = payroll.reduce((acc, p) => acc + p.retentionBonus.amount, 0);
  return Math.round(total / payroll.length);
};

export const generateExecutiveReport = async (
  employees: Employee[],
  payrollData: PayrollEntry[],
  monthName: string
): Promise<string> => {
  if (!process.env.API_KEY) {
    return "API Key not configured. Please check environment variables.";
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const deptCounts = employees.reduce((acc, emp) => {
    acc[emp.department] = (acc[emp.department] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalPayroll = payrollData.reduce((acc, p) => acc + p.netSalary, 0);
  const avgRetention = calculateAvgRetention(payrollData);

  const prompt = `
    You are an expert HR Analyst for a startup. Analyze the following monthly HR data for ${monthName} and provide a 
    concise "Founder's Executive Summary".

    Data:
    - Total Employees: ${employees.length}
    - Department Breakdown: ${JSON.stringify(deptCounts)}
    - Total Net Salary Processed: $${totalPayroll.toLocaleString()}
    - Average Retention Bonus Accrued (Year-to-Date context): $${avgRetention.toLocaleString()} per employee.

    Please provide:
    1. A one-sentence financial health summary regarding payroll.
    2. A strategic observation about headcount distribution.
    3. A brief recommendation on retention based on the bonus data.
    
    Keep the tone professional, concise, and actionable. Do not use markdown bolding too heavily.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Unable to generate insights at this time.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error connecting to AI service. Please try again later.";
  }
};