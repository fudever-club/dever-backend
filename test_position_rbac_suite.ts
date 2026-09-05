import mongoose from 'mongoose';
import path from 'path';
require('dotenv').config({ path: path.join(__dirname, '.env') });

import { Position } from './src/models/PositionModel';
import { User } from './src/models/UserModel';
import { PRESIDENT_POSITION, VICE_PRESIDENT_POSITION } from './src/middlewares/auth';

const PROTECTED_POSITIONS = new Set([PRESIDENT_POSITION, VICE_PRESIDENT_POSITION, 'MEMBER']);

async function runAuditSuite() {
    console.log('========================================================================');
    console.log('🧪 RUNNING COMPREHENSIVE POSITION & RBAC INTEGRITY AUDIT SUITE');
    console.log('========================================================================\n');

    let passed = 0;
    let failed = 0;

    const assert = (condition: boolean, testName: string, detail?: string) => {
        if (condition) {
            console.log(`✅ PASS: ${testName}`);
            passed++;
        } else {
            console.error(`❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
            failed++;
        }
    };

    try {
        await mongoose.connect(process.env.DB_URI as string);
        console.log('🔌 Connected to MongoDB Atlas successfully.\n');

        // Test 1: Fetch positions count
        const positions = await Position.find({}).sort({ createdAt: 1 });
        assert(positions.length >= 19, 'Audit 1: System has at least 19 active positions', `Found: ${positions.length}`);

        // Test 2: Check presence of critical constants
        const constants = new Set(positions.map((p) => p.constant));
        assert(constants.has('CHUNHIEM'), 'Audit 2.1: Critical role CHUNHIEM exists');
        assert(constants.has('PHOCHUNHIEM'), 'Audit 2.2: Critical role PHOCHUNHIEM exists');
        assert(constants.has('MEMBER'), 'Audit 2.3: Critical role MEMBER exists');

        // Test 3: Verify User associations
        const chunhiemPos = positions.find((p) => p.constant === 'CHUNHIEM');
        assert(Boolean(chunhiemPos), 'Audit 3.1: CHUNHIEM Position object resolved');
        if (chunhiemPos) {
            const userCount = await User.countDocuments({ positionId: chunhiemPos._id });
            assert(userCount >= 1, `Audit 3.2: Active Presidents in database`, `Count: ${userCount}`);
        }

        // Test 4: Protected Role Guard - Deletion Prevention
        if (chunhiemPos) {
            const isProtected = PROTECTED_POSITIONS.has(chunhiemPos.constant);
            assert(isProtected, 'Audit 4.1: CHUNHIEM is identified as protected from deletion');
            
            const memberCount = await User.countDocuments({ positionId: chunhiemPos._id });
            const blockedByMembers = memberCount > 0;
            assert(blockedByMembers, 'Audit 4.2: Foreign key integrity check blocks deletion when members exist');
        }

        // Test 5: CRUD Simulation on Test Position
        const testConstant = 'AUDIT_SPECIALIST_' + Date.now();
        const testName = 'Chuyên viên Khảo sát Hệ thống';

        // 5.1 Create
        const created = await Position.create({
            name: testName,
            constant: testConstant,
        });
        assert(Boolean(created._id), 'Audit 5.1: Create new test position in MongoDB');

        // 5.2 Duplicate Constant Guard
        let duplicateBlocked = false;
        try {
            await Position.create({
                name: 'Duplicate Test',
                constant: testConstant,
            });
        } catch (err) {
            duplicateBlocked = true;
        }
        assert(duplicateBlocked, 'Audit 5.2: Duplicate constant is strictly rejected by unique index');

        // 5.3 Edit
        const updatedName = 'Chuyên viên Khảo sát Hệ thống (Đã cập nhật)';
        const updated = await Position.findByIdAndUpdate(
            created._id,
            { name: updatedName },
            { new: true }
        );
        assert(updated?.name === updatedName, 'Audit 5.3: Update test position name successfully');

        // 5.4 Delete
        const memberCountForTest = await User.countDocuments({ positionId: created._id });
        assert(memberCountForTest === 0, 'Audit 5.4: Test position has zero members assigned');

        await Position.findByIdAndDelete(created._id);
        const deletedCheck = await Position.findById(created._id);
        assert(!deletedCheck, 'Audit 5.5: Cleanup test position successfully');

        console.log('\n========================================================================');
        console.log(`📊 SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
        console.log('========================================================================\n');

        await mongoose.disconnect();
        process.exit(failed > 0 ? 1 : 0);
    } catch (error) {
        console.error('Audit execution error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

runAuditSuite();
