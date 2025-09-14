const express = require('express');
const prisma = require('../lib/prisma');
const { validateApiToken } = require('../middleware/auth');
const router = express.Router();

/**
 * @swagger
 * /api/crawljobs/verify/{jobId}:
 *   post:
 *     summary: Verify crawl job with 6-digit code
 *     description: Verifies a crawl job using the 6-digit verification code. Max 5 attempts allowed.
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: The crawl job ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - verifyCode
 *             properties:
 *               verifyCode:
 *                 type: string
 *                 pattern: '^[0-9]{6}$'
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Verification successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 jobId:
 *                   type: string
 *       400:
 *         description: Invalid verification code or job not found
 *       429:
 *         description: Too many attempts - job cancelled
 */
router.post('/crawljobs/verify/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { verifyCode } = req.body;

    if (!verifyCode || !/^[0-9]{6}$/.test(verifyCode)) {
      return res.status(400).json({
        error: 'Invalid verification code',
        message: 'Please provide a valid 6-digit verification code'
      });
    }

    const crawlJob = await prisma.crawlJob.findUnique({
      where: { id: jobId }
    });

    if (!crawlJob) {
      return res.status(404).json({
        error: 'Job not found',
        message: 'Crawl job not found'
      });
    }

    if (crawlJob.cancelled) {
      return res.status(400).json({
        error: 'Job cancelled',
        message: 'This crawl job has been cancelled due to too many verification attempts'
      });
    }

    if (crawlJob.verified) {
      return res.status(400).json({
        error: 'Already verified',
        message: 'This crawl job has already been verified'
      });
    }

    // Check if verification code matches
    if (crawlJob.verifyToken === verifyCode) {
      // Success - verify the job
      await prisma.crawlJob.update({
        where: { id: jobId },
        data: {
          verified: true,
          status: 'verified'
        }
      });

      return res.json({
        message: 'Verification successful',
        jobId: jobId
      });
    } else {
      // Increment attempts
      const newAttempts = crawlJob.verifyAttempts + 1;
      
      if (newAttempts >= 5) {
        // Cancel the job after 5 failed attempts
        await prisma.crawlJob.update({
          where: { id: jobId },
          data: {
            verifyAttempts: newAttempts,
            cancelled: true,
            status: 'cancelled'
          }
        });

        return res.status(429).json({
          error: 'Too many attempts',
          message: 'Maximum verification attempts reached. Job has been cancelled.',
          attemptsRemaining: 0
        });
      } else {
        // Update attempts count
        await prisma.crawlJob.update({
          where: { id: jobId },
          data: {
            verifyAttempts: newAttempts
          }
        });

        return res.status(400).json({
          error: 'Invalid verification code',
          message: 'Verification code is incorrect',
          attemptsRemaining: 5 - newAttempts
        });
      }
    }
  } catch (error) {
    console.error('Error verifying crawl job:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to verify crawl job'
    });
  }
});

/**
 * @swagger
 * /api/crawljobs:
 *   post:
 *     summary: Create a new crawl job
 *     description: Creates a new crawl job with URL and email
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *               - email
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 example: https://example.com
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *     responses:
 *       201:
 *         description: Crawl job created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 url:
 *                   type: string
 *                 email:
 *                   type: string
 *                 status:
 *                   type: string
 *                 verified:
 *                   type: boolean
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Bad request - missing required fields
 *       401:
 *         description: Unauthorized - missing or invalid API token
 */
router.post('/crawljobs', validateApiToken, async (req, res) => {
  try {
    const { url, email } = req.body;

    if (!url || !email) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Both url and email are required'
      });
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return res.status(400).json({
        error: 'Invalid URL',
        message: 'Please provide a valid URL'
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email',
        message: 'Please provide a valid email address'
      });
    }

    // Generate 6-digit verification code
    const verifyToken = Math.floor(100000 + Math.random() * 900000).toString();

    const crawlJob = await prisma.crawlJob.create({
      data: {
        url,
        email,
        verifyToken
      }
    });

    res.status(201).json(crawlJob);
  } catch (error) {
    console.error('Error creating crawl job:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create crawl job'
    });
  }
});

module.exports = router;