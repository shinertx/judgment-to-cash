# Project Identity — Judgment-to-Cash

## What This Is
A "Judgment-to-Cash" platform (attorney-supervised) that converts court judgments into recovered dollars through underwriting and automated enforcement routing. Users assign recovery rather than buying software.

## Initial Wedge
Bexar County default judgments.

## Core Engines
1. **Intake + Assignment:** PDF upload/case number pull, e-sign engagement & fee agreement, KYC.
2. **Judgment Underwriting Engine:** Generates a Recovery Score and Next-Best Action (Garnishment, Discovery, Lien, Skip).
3. **Enforcement Automation Engine:** Document generation, e-filing via EFSP, service coordination, rejection handling tracking.
4. **Operations Control Plane:** Internal dashboard for exception handling, quality checks, and SLA tracking.
5. **Plaintiff Dashboard:** Simple status transparency ("Underwriting → Filed → Served → Frozen → Funds Received → Disbursed").

## Key Constraints
- UPL: Must operate under supervising Texas counsel.
- Court rejection risk: Build an explicit fix/resubmit loop.

## Port
4040

## Subdomain
recover.jockeyvc.com
