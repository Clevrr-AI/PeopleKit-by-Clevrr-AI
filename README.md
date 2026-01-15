# PeopleKit by Clevrr AI: Modern Open-Source HRMS

PeopleKit by Clevrr AI is a lightweight, high-performance Internal Human Resource Management System (HRMS) designed for small to medium-sized organizations. Built with a focus on transparency, efficiency, and real-time data, it streamlines everything from geofenced attendance to automated payroll processing.

## 🚀 Overview

PeopleKit provides a unified platform for employees, managers, and founders to handle professional operations. The platform is built as a Progressive Web App (PWA), ensuring it works seamlessly across desktop and mobile devices with offline capabilities.

## ✨ Key Features

### 1. Smart Attendance & Geofencing
*   **Location-Aware Check-In:** Employees can mark attendance only within a specified radius of the office using GPS.
*   **Remote Work Support:** Integrated workflows for "Working from Home" (WFH) and "Out of Office" (OOO) requests.
*   **Late-In Tracking:** Automatic monitoring of late check-ins with a built-in "warning pass" system.

### 2. Comprehensive Leave Management
*   **Automated Quotas:** Real-time tracking of Casual Leave (CL), Sick Leave (SL), and Half-Day Leaves (HDL).
*   **Branching Logic:** Instant auto-approval for short sick leaves, with escalations for longer durations or quota overflows.
*   **Founder Escalations:** Complex leave requests can be escalated for final founder-level approval.

### 3. Automated Payroll & Financials
*   **Salary Processing:** Founders can generate monthly payslips with one click, automatically calculating tax, leave deductions, and late-check-in penalties.
*   **Reimbursements:** Digital expense claiming with receipt upload support and multi-stage approval.
*   **Retention Bonuses:** A unique incentive system that rewards employees for high attendance and low leave usage.

### 4. Interactive Organization Directory
*   **Real-Time Status:** Instantly see who is "Available", "On Leave", or "WFH".
*   **Profile Management:** Secure storage for bank details, educational documents, and professional credentials.

## 🛠 Tech Stack

*   **Frontend:** React 19 (ESM based, no build step required).
*   **Styling:** Tailwind CSS.
*   **Backend/Database:** Firebase Firestore.
*   **Authentication:** Firebase Auth.
*   **Charts:** Recharts for attendance and financial trends.
*   **PWA:** Service Workers for offline persistence and home-screen installation.

## 📂 Project Structure

*   `index.html`: The entry point using modern ESM import maps.
*   `App.tsx`: Core routing and global state management.
*   `types.ts`: TypeScript interfaces for the entire data model.
*   `components/`: Modular React components for each platform feature.
*   `sw.js`: Service worker for offline asset caching.

## ⚙️ Setup & Installation

This project is designed to be extremely portable. No complex `npm install` chains are required for basic deployment.

1.  **Firebase Setup:**
    *   Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com/).
    *   Enable **Firestore Database** and **Authentication** (Email/Password).
    *   Update the `firebaseConfig` object in `firebase.ts` with your project credentials.

2.  **Deployment:**
    *   Simply host the root directory on any static web host (Firebase Hosting, Vercel, or GitHub Pages).
    *   The app uses ESM modules, so it resolves dependencies via `esm.sh` directly in the browser.

3.  **Role Configuration:**
    *   Users are assigned roles (`Employee`, `Manager`, `Founder`) in the `users` collection.
    *   Only `Founders` have access to salary processing and employee deletion.

## 🔒 Security & Privacy

*   **Role-Based Access Control (RBAC):** Sensitive data like bank details and salary configurations are restricted based on user roles and document ownership.
*   **Offline Persistence:** Uses Firestore's `enableIndexedDbPersistence` to allow secure access to personal data even without an internet connection.

## 🤝 Contributing

We welcome contributions from the community! Whether it's adding a new payroll feature or improving the UI, feel free to fork the repository and submit a pull request.

---
*Built for the future of internal work culture at Clevrr AI.*