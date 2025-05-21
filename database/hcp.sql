-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: May 21, 2025 at 07:41 AM
-- Server version: 10.4.28-MariaDB
-- PHP Version: 8.2.4

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `hcp`
--

-- --------------------------------------------------------

--
-- Table structure for table `interaction_logs`
--

CREATE TABLE `interaction_logs` (
  `id` int(11) NOT NULL,
  `hcpName` varchar(255) DEFAULT NULL,
  `interactionType` varchar(100) DEFAULT NULL,
  `interactionDate` date DEFAULT NULL,
  `interactionTime` time DEFAULT NULL,
  `attendees` text DEFAULT NULL,
  `topicsDiscussed` text DEFAULT NULL,
  `sentiment` varchar(50) DEFAULT NULL,
  `outcomes` text DEFAULT NULL,
  `followUpActions` text DEFAULT NULL,
  `chatSessionId` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `interaction_logs`
--

INSERT INTO `interaction_logs` (`id`, `hcpName`, `interactionType`, `interactionDate`, `interactionTime`, `attendees`, `topicsDiscussed`, `sentiment`, `outcomes`, `followUpActions`, `chatSessionId`, `created_at`) VALUES
(43, 'Dr. Evelyn Hayes', 'Virtual Call', '2025-05-17', '15:30:00', NULL, 'OncoBoost clinical trial data, OncoBoost efficacy in refractory cases, OncoBoost comparison with standard treatments, PulmoClear mechanism of action', 'Positive', 'Dr. Hayes agreed to consider OncoBoost for two upcoming patient cases.', 'Send detailed PulmoClear monograph within 48 hours, schedule a brief check-in call in 3 weeks', 'frontend_session_1747573988563_bb4vory8x', '2025-05-18 13:13:10'),
(44, 'Dr. Hayes', 'Meeting', '2025-05-20', '08:41:00', NULL, NULL, 'Positive', 'Recommended follow-up', 'Follow up in 3 weeks', 'frontend_session_1747710766253_8rw4enmrt', '2025-05-20 03:12:48'),
(45, 'Dr. Hayes', 'Meeting', '2025-05-20', '08:41:00', NULL, NULL, 'Neutral', 'Recommended follow-up', 'Follow up in 3 weeks', 'frontend_session_1747710766253_8rw4enmrt', '2025-05-20 03:13:22');

-- --------------------------------------------------------

--
-- Table structure for table `interaction_materials_shared`
--

CREATE TABLE `interaction_materials_shared` (
  `id` int(11) NOT NULL,
  `interaction_log_id` int(11) DEFAULT NULL,
  `material_name` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `interaction_materials_shared`
--

INSERT INTO `interaction_materials_shared` (`id`, `interaction_log_id`, `material_name`) VALUES
(42, 43, 'OncoBoost trial publication PDF');

-- --------------------------------------------------------

--
-- Table structure for table `interaction_products_discussed_ai`
--

CREATE TABLE `interaction_products_discussed_ai` (
  `id` int(11) NOT NULL,
  `interaction_log_id` int(11) DEFAULT NULL,
  `product_name` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `interaction_products_discussed_ai`
--

INSERT INTO `interaction_products_discussed_ai` (`id`, `interaction_log_id`, `product_name`) VALUES
(43, 43, 'OncoBoost'),
(44, 43, 'PulmoClear');

-- --------------------------------------------------------

--
-- Table structure for table `interaction_samples_distributed`
--

CREATE TABLE `interaction_samples_distributed` (
  `id` int(11) NOT NULL,
  `interaction_log_id` int(11) DEFAULT NULL,
  `sample_name` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `interaction_samples_distributed`
--

INSERT INTO `interaction_samples_distributed` (`id`, `interaction_log_id`, `sample_name`) VALUES
(42, 43, 'OncoBoost');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `interaction_logs`
--
ALTER TABLE `interaction_logs`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `interaction_materials_shared`
--
ALTER TABLE `interaction_materials_shared`
  ADD PRIMARY KEY (`id`),
  ADD KEY `interaction_log_id` (`interaction_log_id`);

--
-- Indexes for table `interaction_products_discussed_ai`
--
ALTER TABLE `interaction_products_discussed_ai`
  ADD PRIMARY KEY (`id`),
  ADD KEY `interaction_log_id` (`interaction_log_id`);

--
-- Indexes for table `interaction_samples_distributed`
--
ALTER TABLE `interaction_samples_distributed`
  ADD PRIMARY KEY (`id`),
  ADD KEY `interaction_log_id` (`interaction_log_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `interaction_logs`
--
ALTER TABLE `interaction_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=46;

--
-- AUTO_INCREMENT for table `interaction_materials_shared`
--
ALTER TABLE `interaction_materials_shared`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=43;

--
-- AUTO_INCREMENT for table `interaction_products_discussed_ai`
--
ALTER TABLE `interaction_products_discussed_ai`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=45;

--
-- AUTO_INCREMENT for table `interaction_samples_distributed`
--
ALTER TABLE `interaction_samples_distributed`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=43;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `interaction_materials_shared`
--
ALTER TABLE `interaction_materials_shared`
  ADD CONSTRAINT `interaction_materials_shared_ibfk_1` FOREIGN KEY (`interaction_log_id`) REFERENCES `interaction_logs` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `interaction_products_discussed_ai`
--
ALTER TABLE `interaction_products_discussed_ai`
  ADD CONSTRAINT `interaction_products_discussed_ai_ibfk_1` FOREIGN KEY (`interaction_log_id`) REFERENCES `interaction_logs` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `interaction_samples_distributed`
--
ALTER TABLE `interaction_samples_distributed`
  ADD CONSTRAINT `interaction_samples_distributed_ibfk_1` FOREIGN KEY (`interaction_log_id`) REFERENCES `interaction_logs` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
